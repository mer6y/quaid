const superagent = require('superagent');
const config = require('./config');
const items = require('./items');
const {print, sleep, random} = require("./globals");
const {setWhitelistBody, options} = require("./config");
const database = require('./database');
const twofactor = require('node-2fa');
require('superagent-proxy')(superagent);

const cookie = config.options().authentication["roblox cookie"];

const globals = {
    id: 1,
    username: 'Roblox',
    displayName: 'Roblox',
    csrf: 'abcdefghijk',

    roblosecurity: cookie,
    sessionid: ``,

    inventory: [],
    fullInventory: []
};

const authenticated = superagent.agent();

const refreshAgentHeaders = () => authenticated.set('cookie',
    `.ROBLOSECURITY=${globals.roblosecurity}; ${globals.sessionid ? `RBXSessionTracker=${globals.sessionid}` : ''}`)
refreshAgentHeaders();

/**
 * This was previously used to get the session id from the cookie, but it's no longer needed
 * as the bypass no longer works.
 */
const updateSessionId = cookiesArray => {
    const array = cookiesArray.join(';');
    globals.sessionid = array.split('RBXSessionTracker=')[1].split('; ')[0] || globals.sessionid;
    refreshAgentHeaders();
}

const validateCookie = () => new Promise(async resolve => {
    authenticated.get('https://roblox.com/my/settings/json')
        .proxy(config.getProxy())
        .then(resp => {
            if (!resp || !resp.body || !Object.keys(resp.body).length) {
                print(`failed to fetch info from roblox.\nmake sure your proxies and cookie are valid.`, 'error');
                return process.exit();
            }

            const body = resp.body;
            globals.id = body.UserId;
            globals.username = body.Name;
            globals.displayName = body.DisplayName;

            setWhitelistBody({
                discordId: options().authentication['discord id'],
                userId: globals.id,
            })

            updateSessionId(resp.headers['set-cookie']);

            return resolve();
        })
        .catch(err => {
            if (!err || !err.response)
                print(`failed to fetch info from roblox.\nmake sure you're connected to the internet and your proxies are valid.`, 'error');
            else
                print(`failed to fetch info from roblox.\nmake sure your proxies and cookie are valid.`, 'error');

            return process.exit();
        })
});
const declineTrade = async (tradeId) => new Promise(resolve => {
    authenticated.post(`https://trades.roblox.com/v1/trades/${tradeId}/decline`)
        .set('x-csrf-token', globals.csrf)
        .proxy(config.getProxy())
        .send({})
        .then(resolve(true))
        .catch(async err => {
            if (!err || !err.response)
                return resolve(await declineTrade(tradeId));

            const {body} = err.response;
            if (!body || !Object.keys(body).length) return resolve();

            const newCSRF = err.response.headers['x-csrf-token'];
            if (newCSRF) {
                globals.csrf = newCSRF || globals.csrf;
                return resolve(await declineTrade(tradeId));
            }

            if (err.response.text.includes('TooManyRequests')) {
                print(`failed to decline trade ${tradeId} bc too many requests`, 'error')
                await sleep(2 * 1000);
                return resolve(await declineTrade(tradeId));
            }

            resolve(true);
        })
});

const sendTrade = async (player, offeringUaids, requestingUaids, tradeId) => new Promise(resolve => {
    let url = 'https://trades.roblox.com/v1/trades/send';
    if (tradeId) url = `https://trades.roblox.com/v1/trades/${tradeId}/counter`

    authenticated.post(url)
        .set('x-csrf-token', globals.csrf)
        .set('content-type', 'application/json')
        .proxy(config.getProxy())
        .send({
            offers: [{
                userId: `${globals.id}${'\t'.repeat(random(0, 300))}`,
                userAssetIds: offeringUaids,
                robux: 0
            }, {
                userId: player.id,
                userAssetIds: requestingUaids,
                robux: 0
            }]
        })
        .then(resp => {
            if (!resp || !resp.body) return resolve();
            return resolve(resp.body.id);
        })
        .catch(async err => {
            if (!err || !err.response) return resolve();

            const {body} = err.response;
            if (!body || !Object.keys(body).length) return resolve();

            const newCSRF = err.response.headers['x-csrf-token'];
            if (newCSRF) {
                globals.csrf = newCSRF || globals.csrf;
                return resolve(await sendTrade(player, offeringUaids, requestingUaids));
            }

            if (err.response.text.includes('TooManyRequests')) {
                print(`failed to send trade to ${player.username} bc too many requests`, 'error')
                await sleep(2 * 1000);
                return resolve(await sendTrade(player, offeringUaids, requestingUaids));
            }

            const errors = body.errors;
            if (!errors || !errors[0]) return resolve();

            const error = errors[0];
            if (error.code === 16) {
                print(`${player.username} has a tr#de filter, skipping...`, 'error');
                await database.setPlayerCooldown(player.id, 2)
                return resolve();
            } else if (error.code === 14) {
                print(`24 hour cooldown message hit when attempting to send to ${player.username}, retrying...`, 'error');
                await sleep(2 * 1000);
                return resolve(await sendTrade(player, offeringUaids, requestingUaids));
            }

            console.log(body);
            resolve();
        })
});
const getInventory = (id, data = [], cursor = null) => new Promise(resolve => {
    let url = `https://inventory.roblox.com/v1/users/${id}/assets/collectibles?limit=100`;
    if (cursor) url += `&cursor=${cursor}`;

    superagent('GET', url)
        .then(async resp => {
            if (!resp || !resp.body || !resp.body.data)
                return resolve([]);

            const {nextPageCursor} = resp.body;

            for (const rawItemDetails of resp.body.data || []) {
                const item = items.get(rawItemDetails.assetId);
                if (!item) continue;

                item.uaid = rawItemDetails.userAssetId;
                item.serial = rawItemDetails.serialNumber;

                data.push(item);
            }

            if (nextPageCursor && data.length < 5 * 100)
                return resolve(await getInventory(id, data, nextPageCursor));
            return resolve(data);
        })
        .catch(async err => {
            if (!err || !err.response)
                return resolve(await getInventory(id, data, cursor));

            const text = err.response.text;
            if (
                text.includes('TooManyRequests') ||
                text.includes('InternalServerError')
            ) return resolve(await getInventory(id, data, cursor));

            return resolve([]);
        })
});
const updateMyInventory = async () => {
    const myInventory = await getInventory(globals.id);
    const remadeInventory = [];

    for (const item of myInventory) {
        if (!item.whitelist.offer) continue;
        if (
            options().items['do not trade away'].map(i => Number(i)).includes(item.uaid)
        ) continue;

        remadeInventory.push(item);
    }

    globals.inventory = remadeInventory.sort((a, b) => b.offer - a.offer);
    globals.fullInventory = myInventory;
};
const lastOnline = async id => new Promise(resolve => {
    superagent('GET', `https://api.roblox.com/users/${id}/onlinestatus/`)
        .then(resp => {
            if (!resp.body || !Object.keys(resp.body).length)
                return resolve(0);

            return resolve(new Date(resp.body.LastOnline).getTime());
        })
        .catch(() => {
            resolve(0);
        })
});
const canTradeWith = async id => new Promise(resolve => {
    authenticated.head(`https://www.roblox.com/users/${id}/trade`)
        .proxy(config.getProxy())
        .then(() => resolve(true))
        .catch(err => {
            if (!err || !err.response) return resolve(false);
            return resolve(false);
        })
});

const generate2faCode = () => {
    const mfaSecret = options().authentication["2fa code secret"];
    const newToken = twofactor.generateToken(mfaSecret);

    if (!newToken || !newToken.token)
        return;
    return newToken.token;
};
const generateVerifyUUID = () => new Promise(resolve => {
    authenticated.post(`https://trades.roblox.com/v1/trade-friction/two-step-verification/generate`)
        .set('x-csrf-token', globals.csrf)
        .proxy(config.getProxy())
        .then(resp => {
            const uuid = resp.text.slice(1, -1);
            return resolve(uuid);
        })
        .catch(async err => {
            if (!err || !err.response)
                return resolve();

            const csrf = err.response.headers['x-csrf-token'];
            if (csrf) {
                globals.csrf = csrf || globals.csrf;
                return resolve(await generateVerifyUUID());
            }

            return resolve();
        })
})
const submit2faCode = (challengeId, code) => new Promise(resolve => {
    authenticated.post(`https://twostepverification.roblox.com/v1/users/${globals.id}/challenges/authenticator/verify`)
        .set('x-csrf-token', globals.csrf)
        .proxy(config.getProxy())
        .send({
            challengeId,
            actionType: 'ItemTrade',
            code: code.toString()
        })
        .then(resp => {
            if (!resp || !resp.body || !resp.body.verificationToken)
                return resolve(false);

            const verificationToken = resp.body.verificationToken;
            return resolve(verificationToken);
        })
        .catch(async err => {
            if (!err || !err.response)
                return resolve();

            const csrf = err.response.headers['x-csrf-token'];
            if (csrf) {
                globals.csrf = csrf || globals.csrf;
                return resolve(await submit2faCode(
                    challengeId, code
                ));
            }

            return resolve();
        })
})
const redeemVerificationToken = (challengeId, verificationToken) => new Promise(resolve => {
    authenticated.post(`https://trades.roblox.com/v1/trade-friction/two-step-verification/redeem`)
        .set('x-csrf-token', globals.csrf)
        .proxy(config.getProxy())
        .send({
            challengeToken: challengeId,
            verificationToken
        })
        .then(resp => {
            return resolve(resp.text === 'true');
        })
        .catch(async err => {
            if (!err || !err.response)
                return resolve();

            const csrf = err.response.headers['x-csrf-token'];
            if (csrf) {
                globals.csrf = csrf || globals.csrf;
                return resolve(await redeemVerificationToken(
                    challengeId, verificationToken
                ));
            }

            return resolve();
        })
});
const solve2fa = async () => {
    if (!options().miscellaneous["automatically solve mfa"]) return;
    if (!options().authentication["2fa code secret"]) return;

    const startTime = Date.now();
    print(`checking mfa status...`, 'info');

    const verifyUuid = await generateVerifyUUID();
    if (!verifyUuid) return;

    const mfaKey = generate2faCode();
    if (!mfaKey) return;

    const verificationToken = await submit2faCode(
        verifyUuid,
        mfaKey
    );

    if (!verificationToken) {
        print(`failed to complete mfa, make sure your "2fa code secret" is correct`, 'error');
        return;
    }

    const redeemStatus = await redeemVerificationToken(
        verifyUuid,
        verificationToken
    )

    if (!redeemStatus) {
        print(`failed to redeem mfa token, mfa was not successfully completed`, 'error');
        return;
    }

    print(`successfully completed mfa in ${Date.now() - startTime}ms !!`, 'success')
};

const getAuthTicket = async () => new Promise(resolve => {
    superagent.post('https://auth.roblox.com/v1/authentication-ticket')
        .set('content-type', 'application/json')
        .set('user-agent', 'Roblox/WinInet')
        .set('origin', 'https://www.roblox.com')
        .set('referer', 'https://www.roblox.com/my/account')
        .set('x-csrf-token', globals.csrf)
        .set('cookie', globals.cookieheader)
        .proxy(config.getProxy(0))
        .then(resp => {
            return resolve(resp.headers['rbx-authentication-ticket'])
        })
        .catch(async err => {
            if (!err || !err.response)
                return resolve();

            const csrf = err.response.headers['x-csrf-token'];
            if (csrf) {
                globals.csrf = csrf || globals.csrf;
                return resolve(await getAuthTicket());
            }
            return resolve();
        })
})
const redeemTicket = async ticket => new Promise(resolve => {
    superagent.post('https://auth.roblox.com/v1/authentication-ticket/redeem')
        .set('content-type', 'application/json')
        .set('rbxauthenticationnegotiation', 1)
        .set('user-agent', 'Roblox/WinInet')
        .set('origin', 'https://www.roblox.com')
        .set('referer', 'https://www.roblox.com/my/account')
        .set('x-csrf-token', globals.csrf)
        .set('cookie', globals.cookieheader)
        .proxy(config.getProxy(0))
        .send({
            authenticationTicket: ticket
        })
        .then(resp => {
            console.log(resp.headers['set-cookie'])
            const newCookie = resp.headers['set-cookie'].join(',').split('.ROBLOSECURITY=')[1].split('; domain=')[0];
            resolve(newCookie);
        })
        .catch(async err => {
            if (!err || !err.response)
                return resolve();

            const csrf = err.response.headers['x-csrf-token'];
            if (csrf) {
                globals.csrf = csrf || globals.csrf;
                return resolve(await redeemTicket(ticket));
            }
            return resolve();
        })
});
const generateNewCookie = async () => {
    const authTicket = await getAuthTicket();

    const newCookie = await redeemTicket(authTicket);
    if (!newCookie) return;

    print('regenerated cookie', 'success')

    globals.cookieheader = `'.ROBLOSECURITY=${newCookie}`;
}

module.exports = {
    validateCookie,
    getInventory,
    sendTrade,
    declineTrade,
    canTradeWith,
    updateMyInventory,
    lastOnline,
    solve2fa,
    generateNewCookie,
    info: () => globals
}
