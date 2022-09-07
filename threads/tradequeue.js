const queues = require("../lib/queues");
const roblox = require('../lib/roblox');
const discord = require("../lib/discord");
const database = require("../lib/database");
const {print} = require('../lib/globals');
require('colors');

let totalTradesSent = 0;
let startTime = Date.now();

const completeTradeQueue = async () => {
    const trade = queues.nextInTradeQueue();
    if (!trade) return setTimeout(completeTradeQueue);

    const isOnCooldown = await database.isOnCooldown(trade.player.id);

    if (isOnCooldown) {
        print(`sent to ${trade.player.username} too recently! skipping..`, 'debug')
        return setTimeout(completeTradeQueue);
    }

    const tradeResponse = await roblox.sendTrade(
        trade.player,
        trade.itemsOffering.map(i => i.uaid),
        trade.itemsRequesting.map(i => i.uaid)
    )

    // console.log(tradeResponse);

    if (!tradeResponse) return setTimeout(completeTradeQueue);

    print(`successfully sent a trade to ${trade.player.username} (id: ${tradeResponse})`.rainbow);
    totalTradesSent++;

    discord.testOfferingMessage(trade.itemsOffering, trade.itemsRequesting, trade.tradeType, trade.player);
    database.setPlayerCooldown(trade.player.id, 8);
    await database.setOutbound(tradeResponse, trade.player, trade, trade.tradeType)

    const minutesSinceStart = (Date.now() - startTime) / 1000 / 60;
    // console.log(`${Math.round(totalTradesSent/minutesSinceStart*10)/10}/min trades sent`)

    return setTimeout(completeTradeQueue);
}

const main = async () => {
    for (let i = 0; i < 1; i++)
        completeTradeQueue().then();
}

main();