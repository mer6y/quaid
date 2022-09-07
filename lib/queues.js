const {options} = require("./config");
let playerQueue = [];
let tradeQueue = [];

module.exports = {
    nextInPlayerQueue: () => playerQueue.pop(),
    queuePlayer: async playerObject => {
        const idsQueued = playerQueue.map(i => i.id)

        const userIdBlacklist = options().players['do not send to'];
        playerObject.id = Number(playerObject.id);

        if (
            !idsQueued.includes(playerObject.id) &&
            !userIdBlacklist.includes(playerObject.id)
        ) playerQueue.push(playerObject)

        playerQueue = playerQueue.sort((a, b) => a.priority - b.priority);
    },
    getPlayerQueue: () => playerQueue,

    nextInTradeQueue: () => tradeQueue.pop(),
    queueTrade: trade => {
        const sendingTo = trade.player.id;
        const userIdsToSendTo = tradeQueue.map(i => i.player.id);
        if (!userIdsToSendTo.includes(sendingTo))
            tradeQueue.push(trade);

        tradeQueue = tradeQueue.sort((a, b) => a.priority - b.priority)
    },
    clearTradeQueueWhenOffering: (uaids) => {
        tradeQueue = tradeQueue.filter(trade => {
            for (const item of trade.itemsOffering)
                if (uaids.includes(item.uaid))
                    return false;
            return true;
        })
    },
    getTradeQueue: () => tradeQueue,
}