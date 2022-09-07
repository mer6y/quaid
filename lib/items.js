const superagent = require('superagent');
const {options, getPersonalCustomValues, getWhitelistBody} = require('./config');
const {print} = require('./globals');
const {encrypt, decrypt} = require('./enc');

const demandAssignments = {
    '-1': 'unrated',
    0: 'terrible',
    1: 'low',
    2: 'normal',
    3: 'high',
    4: 'amazing'
}
const trendAssignments = {
    '-1': 'unrated',
    0: 'lowering',
    1: 'unstable',
    2: 'stable',
    3: 'fluctuating',
    4: 'raising'
}

const startsWithPlusOrMinus = input => ['+', '-'].includes(input[0]);
const mapValues = (unmapped) => {
    const personalCVs = {};
    unmapped.map(line => {
        const segments = line.replace(/,/g, '').split(':');
        if (segments.length < 2) return;

        const itemId = segments[0];

        const offer =
            startsWithPlusOrMinus(segments[1]) ? segments[1] : Number(segments[1]);
        const request =
            segments[2] ?
                startsWithPlusOrMinus(segments[2]) ? segments[2] : Number(segments[2]) : offer;

        personalCVs[itemId] = {
            offer,
            request
        }
    });

    return personalCVs;
};

let itemDetails = {};
let quaidiousValues = {};
let ollieItemDetails = {};
let rolimonsItemDetails = {};
let modifiedRapValues = {};
let unmappedServerValues = '';

const refreshRolimonsItemDetails = () => new Promise(resolve => {
    const whitelist = getWhitelistBody();
    whitelist.time = Date.now();

    superagent(`POST`, `https://quaid.mx/bot/values`)
        .send({
            id: whitelist.discordId,
            data: encrypt(whitelist, whitelist.discordId)
        })
        .then(async resp => {
            if (!resp || !resp.body) return resolve();

            if (resp.body.error) {
                print(
                    `your whitelist could not be verified\nplease make sure:\n  1.) you have a current whitelist\n  2.) you have "${whitelist.userId}" whitelisted to your account\n  3.) your discord id is correct in the config`,
                    'error'
                );
                return process.exit();
            }

            const decrypted = decrypt(resp.body.data, whitelist.discordId);
            if (!decrypted) {
                print(
                    `your whitelist could not be verified\nplease make sure:\n  1.) you have a current whitelist\n  2.) you have "${whitelist.userId}" whitelisted to your account\n  3.) your discord id is correct in the config`,
                    'error'
                );
                return process.exit();
            }

            rolimonsItemDetails = decrypted;
            resolve();
        })
        .catch(async err => {
            console.log(err);

            print('failed to fetch item values from rolimons', 'error');
            await new Promise(resolve => setTimeout(resolve, 10 * 1000))
            return resolve(await refreshRolimonsItemDetails());
        })
});
const refreshQuaidiousValues = () => new Promise(resolve => {
    const whitelist = getWhitelistBody();
    whitelist.time = Date.now();

    superagent(`POST`, `https://quaid.mx/bot/customvalues`)
        .send({
            id: whitelist.discordId,
            data: encrypt(whitelist, whitelist.discordId)
        })
        .then(async resp => {
            if (!resp || !resp.body) return resolve();

            if (resp.body.error) {
                print(
                    `your whitelist could not be verified\nplease make sure:\n  1.) you have a current whitelist\n  2.) you have "${whitelist.userId}" whitelisted to your account\n  3.) your discord id is correct in the config`,
                    'error'
                );
                return process.exit();
            }

            const decrypted = decrypt(resp.body.data, whitelist.discordId);
            if (!decrypted) {
                print(
                    `your whitelist could not be verified\nplease make sure:\n  1.) you have a current whitelist\n  2.) you have "${whitelist.userId}" whitelisted to your account\n  3.) your discord id is correct in the config`,
                    'error'
                );
                return process.exit();
            }

            quaidiousValues = decrypted;
            resolve();
        })
        .catch(async () => {
            print('failed to fetch provided custom values from backend', 'error');
            await new Promise(resolve => setTimeout(resolve, 10 * 1000))
            return resolve(await refreshQuaidiousValues());
        })
});
const refreshItemValues = () => new Promise(resolve => {
    superagent('GET', `https://ollie.fund/api/itemdetails`)
        .then(async resp => {
            if (!resp.body) return resolve();
            ollieItemDetails = resp.body;
            resolve();
        })
        .catch(async () => {
            print('failed to fetch item data from ollie!', 'error');
            await new Promise(resolve => setTimeout(resolve, 10 * 1000))
            return resolve(await refreshItemValues());
        });
});
const refreshServerUrlValues = () => new Promise(resolve => {
    superagent(`GET`, options().items['custom value server url'])
        .set(`discordid`, options().authentication['discord id'])
        .set(`user-agent`, `qtb/v3`)
        .then(resp => {
            if (!resp) {
                print(`failed to fetch custom values from provided server url`, 'error');
                return resolve();
            }

            unmappedServerValues = resp.text.split('\n') || unmappedServerValues;
            resolve();
        })
        .catch(err => {
            print(`failed to fetch custom values from provided server url`, 'error');
            print(err.response ? err.response.text : err)
            return resolve();
        })
});
const refreshModifiedRapValues = () => new Promise(resolve => {
    superagent('GET', 'https://projecteds.quaid.mx')
        .then(resp => {
            if (!resp || !resp.body) return resolve();

            modifiedRapValues = resp.body;
            return resolve();
        })
        .catch(() => {
            print(`failed to fetch rap values from backend`, 'error');
            return resolve();
        })
})

const refreshItemDetails = async () => {
    const promises = [
        refreshRolimonsItemDetails(),
        refreshQuaidiousValues(),
        refreshItemValues(),
        refreshModifiedRapValues()
    ];

    await Promise.all(promises);

    let mappedValues = {};
    if (options().items['fetch custom values from server url']) {
        await refreshServerUrlValues();
        mappedValues = mapValues(unmappedServerValues);
        print(`fetched ${Object.keys(mappedValues).length.toLocaleString()} values from server url`, 'success');
    }

    const unmappedPersonalValues = getPersonalCustomValues();
    const mappedPersonalValues = mapValues(unmappedPersonalValues);
    for (const itemId in mappedPersonalValues)
        mappedValues[itemId] = mappedPersonalValues[itemId]

    for (let itemId in rolimonsItemDetails) {
        itemId = Number(itemId);
        const rawOllieDetails = ollieItemDetails[itemId];
        if (!rawOllieDetails) continue;

        const rawRolimonsDetails = rolimonsItemDetails[itemId];
        const rolimonsDetails = {
            name: rawRolimonsDetails[0].trim(),
            acronym: rawRolimonsDetails[1] || null,
            rap: rawRolimonsDetails[2] || 0,
            value: rawRolimonsDetails[3] === -1 ? null : rawRolimonsDetails[3],
            demand: demandAssignments[rawRolimonsDetails[5].toString()],
            trend: trendAssignments[rawRolimonsDetails[6].toString()],
            projected: rawRolimonsDetails[7] === -1,
            hyped: rawRolimonsDetails[8] !== -1,
            rare: rawRolimonsDetails[9] !== -1
        }

        const whitelist = {
            offer: true,
            request: true,

            inboundOffer: true,
            inboundRequest: true
        }

        const customValues = {
            offer: rolimonsDetails.value,
            request: rolimonsDetails.value,

            cved: false,
        }

        const quaidiousValue = quaidiousValues[itemId];
        if (quaidiousValue) {
            customValues.offer = quaidiousValue.offer;
            customValues.request = quaidiousValue.receive;
            customValues.cved = true;
        }

        const personalValue = mappedValues[itemId];
        if (personalValue) {
            const value = rolimonsDetails.value || rolimonsDetails.rap;

            let offerValue = value;
            let requestValue = value;

            if (typeof personalValue.offer === 'string')
                offerValue += Number(personalValue.offer);
            else offerValue = personalValue.offer;

            if (typeof personalValue.request === 'string')
                requestValue += Number(personalValue.request)
            else requestValue = personalValue.request;

            customValues.offer = offerValue;
            customValues.request = requestValue;
            customValues.cved = true;
        }

        const rapItem = !rolimonsDetails.value;

        if (options().items['only trade for rares']) {
            if (!rolimonsDetails.rare) {
                whitelist.request = false;
                whitelist.inboundRequest = false;
            }
        } else if (!options().items['trade for rares'] && rolimonsDetails.rare) {
            if (!customValues.cved || (
                customValues.cved && !options().items['trade for custom valued rares'])
            ) {
                whitelist.request = false;
                whitelist.inboundRequest = false;
            }
        }

        if (!customValues.cved && rapItem) {
            const modifiedRapValue = modifiedRapValues[itemId] || {};
            const adjustedRap = modifiedRapValue.adjustedRap;
            const bestPrice = modifiedRapValue.bestPrice;

            if (options().trading['trade my unvalued rap items'] && adjustedRap) {
                customValues.offer =
                    adjustedRap > rolimonsDetails.rap ?
                        adjustedRap : rolimonsDetails.rap;

                if (
                    bestPrice < adjustedRap &&
                    customValues.offer > bestPrice
                ) customValues.offer = bestPrice;
            } else {
                whitelist.offer = false;
                whitelist.inboundOffer = false;
            }

            if (options().trading['trade for rap'] && adjustedRap) {
                customValues.request =
                    adjustedRap > rolimonsDetails.rap ?
                        rolimonsDetails.rap : adjustedRap;

                if (
                    bestPrice < rolimonsDetails.rap &&
                    customValues.request > bestPrice
                ) customValues.request = bestPrice;
            } else {
                whitelist.request = false;
                whitelist.inboundRequest = false;
            }
        }

        const minimumLimitedTimeInMs = options().items['minimum limited time in days'] * 24 * 60 * 60 * 1000;
        const minimumAverageDailySalesForValue = options().items['minimum average daily sales for value'] || 0;
        const minimumAverageDailySalesForRap = options().items['minimum average daily sales for rap'] || 0.6;

        const updateDate = new Date(rawOllieDetails.updateDate);

        if (Date.now() - updateDate < minimumLimitedTimeInMs) {
            whitelist.request = false;
            whitelist.inboundRequest = false;
        }

        if (rapItem) {
            if (rawOllieDetails.demandScore < minimumAverageDailySalesForRap) {
                whitelist.request = false;
                whitelist.inboundRequest = false;
            }
        } else {
            if (rawOllieDetails.demandScore < minimumAverageDailySalesForValue) {
                whitelist.request = false;
                whitelist.inboundRequest = false;
            }
        }

        const dontSendFor = options().items['do not trade for'].map(i => Number(i));
        if (dontSendFor.includes(itemId)) {
            whitelist.request = false;
            whitelist.inboundRequest = false;
        }

        const dontTradeAway = options().items['do not trade away'].map(i => Number(i));
        if (dontTradeAway.includes(itemId)) {
            whitelist.offer = false;
            whitelist.inboundOffer = false;
        }

        if (
            options().items['do not trade for demand'].map(i => i.toLowerCase()).includes(rolimonsDetails.demand) ||
            options().items['do not trade for trend'].map(i => i.toLowerCase()).includes(rolimonsDetails.trend)
        ) {
            whitelist.request = false;
            whitelist.inboundRequest = false;
        }

        itemDetails[itemId] = {
            id: itemId,
            name: rolimonsDetails.name,
            thumbnail: rawOllieDetails.thumbnailUrl,
            rare: rolimonsDetails.rare,
            value: rolimonsDetails.value || rolimonsDetails.rap || 0,
            rap: rolimonsDetails.rap || 0,
            offer: customValues.offer,
            request: customValues.request,
            whitelist,
        };
    }
};

module.exports = {
    refresh: refreshItemDetails,
    get: id => {
        if (!itemDetails[id]) return;
        return JSON.parse(JSON.stringify(itemDetails[id]))
    }
}