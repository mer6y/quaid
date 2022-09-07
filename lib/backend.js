const superagent = require('superagent');
const queues = require('./queues');
const {print, shuffle} = require("./globals");
const {encrypt, decrypt} = require('./enc');
const {options} = require("./config");
const roblox = require("./roblox");

const discordId = options().authentication["discord id"];

const getPlayers = () => new Promise(resolve => {
    const userId = roblox.info().id;

    superagent(`POST`, `https://quaid.mx/api/v3/players`)
        .send({
            id: discordId,
            data: encrypt({
                time: Date.now(),
                discordId: discordId,
                userId: userId,
            }, discordId)
        })
        .then(async resp => {
            if (!resp || !resp.body) return resolve();

            if (resp.body.error) {
                print(
                    `your whitelist could not be verified\nplease make sure:\n  1.) you have a current whitelist\n  2.) you have "${userId}" whitelisted to your account\n  3.) your discord id is correct in the config`,
                    'error'
                );
                return process.exit();
            }

            const decrypted = decrypt(resp.body.data, discordId);
            if (!decrypted) {
                print(
                    `your whitelist could not be verified\nplease make sure:\n  1.) you have a current whitelist\n  2.) you have "${userId}" whitelisted to your account\n  3.) your discord id is correct in the config`,
                    'error'
                );
                return process.exit();
            }

            const maxDaysSinceLastOnline = options().players['maximum days since last online'];
            const maxMsSinceLastOnline = maxDaysSinceLastOnline * 24 * 60 * 60 * 1000;
            const maxMsSinceLastModified = 14 * 24 * 60 * 60 * 1000;

            let count = 0;

            const playerIds = shuffle(Object.keys(decrypted));
            for (const playerId of playerIds) {
                let player = decrypted[playerId];
                if (!player.username) {
                    player = {
                        lastOnline: player,
                        lastModified: player,
                        username: playerId,
                        blacklist: {}
                    }
                }

                if (player.lastOnline + maxMsSinceLastOnline < Date.now()) continue;
                if (player.lastModified + maxMsSinceLastModified < Date.now()) continue;

                queues.queuePlayer({
                    id: playerId,
                    username: player.username,
                    blacklist: Object.keys(player.blacklist),
                    priority: player.lastOnline
                })
                count++;
            }

            print(`found ${count.toLocaleString()} players online in the last ${maxDaysSinceLastOnline} days`, 'info')
            resolve();
        })
        .catch(async () => {
            print('failed to fetch players from backend', 'error');
            await new Promise(resolve => setTimeout(resolve, 10 * 1000))
            return resolve(await getPlayers());
        })
});
const getRbxFlipPlayers = () => new Promise(resolve => {
    superagent('GET', 'https://rbxflip.foob.cc/')
        .then(resp => {
            if (!resp || !resp.body || !resp.body.data || !resp.body.data.games) return resolve();
            for (const game of resp.body.data.games) {
                if (game.status !== 'Completed') continue;
                queues.queuePlayer({
                    id: game.host.id,
                    username: game.host.name,
                    blacklist: [],
                    priority: Date.now()
                })

                queues.queuePlayer({
                    id: game.player.id,
                    username: game.player.name,
                    blacklist: [],
                    priority: Date.now()
                })
            }

            resolve();
        })
        .catch(() => {
            print(`failed to fetch players from rbxflip`, 'error');
            resolve();
        })
})

module.exports = {
    getPlayers,
    getRbxFlipPlayers
}