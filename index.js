/**
 * Written by Danny
 * Code freely usable without credit
 *
 * https://foob.cc/
 */

const {print, sleep} = require('./lib/globals');
const {options} = require("./lib/config");
const database = require('./lib/database');
const workers = require('./threads/controller');
const roblox = require('./lib/roblox');
const backend = require('./lib/backend');
const items = require('./lib/items');
const queues = require('./lib/queues');
const discord = require("./lib/discord");
const rolimons = require('./lib/rolimons');

const main = async () => {
    await database.connect();

    print('authenticating with roblox...', 'debug')
    await roblox.validateCookie();

    const userInfo = roblox.info();
    print(`welcome to quaid traid, ${userInfo.username} (${userInfo.id}) !! :D`, 'success');

    await items.refresh();
    (async () => {
        for (;;) {
            await sleep(options().items['value update interval in seconds'] * 1000);
            await items.refresh();
        }
    })().then();

    await roblox.updateMyInventory();
    (async () => {
        let cachedInventory = [];
        for (;;) {
            print('local inventory updated', 'debug')

            const previousItems = cachedInventory.map(i => `${i.id}:${i.uaid}`);
            const newItems = roblox.info().fullInventory.map(i => `${i.id}:${i.uaid}`);

            const sentItems = previousItems.filter(i => !newItems.includes(i));
            const receivedItems = newItems.filter(i => !previousItems.includes(i));
            // const sentItems = ['22920501:213474650'];
            // const receivedItems = ['22920501:214263146'];

            if (sentItems.length >= 1 && receivedItems.length >= 1) {
                const formattedSentItems = [];
                const formattedReceivedItems = [];

                for (const rawItem of sentItems) {
                    const split = rawItem.split(':');
                    const itemId = Number(split[0]);
                    const uaid = Number(split[1]);

                    const item = items.get(itemId);
                    if (!item) continue;
                    item.uaid = uaid;

                    formattedSentItems.push(item);
                }

                for (const rawItem of receivedItems) {
                    const split = rawItem.split(':');
                    const itemId = Number(split[0]);
                    const uaid = Number(split[1]);

                    const item = items.get(itemId);
                    if (!item) continue;
                    item.uaid = uaid;

                    formattedReceivedItems.push(item);
                }

                queues.clearTradeQueueWhenOffering(formattedSentItems.map(i => i.uaid));

                discord.sendCompleted(formattedSentItems, formattedReceivedItems);
            }

            cachedInventory = roblox.info().fullInventory;
            await sleep(5 * 1000);
            await roblox.updateMyInventory();
        }
    })().then()

    print(`indexing players...`, 'debug')
    backend.getPlayers();
    setInterval(backend.getRbxFlipPlayers, 60 * 60 * 1000)
    await backend.getRbxFlipPlayers();
    setInterval(backend.getRbxFlipPlayers, 5 * 60 * 1000)

    await rolimons.scrapeTradeAds();
    setInterval(rolimons.scrapeTradeAds, 2 * 60 * 1000)

    setInterval(() => {
        if (queues.getPlayerQueue().length < 100)
            backend.getPlayers();
    }, 25 * 1000)


    // await roblox.generateNewCookie();
    // setInterval(roblox.generateNewCookie, 20 * 60 * 1000)

    roblox.solve2fa();
    setInterval(roblox.solve2fa, 23 * 60 * 60 * 1000)

    print(`starting scanner...`, 'debug')
    workers.startWorkers();
}

main().then();