const superagent = require('superagent');
const queues = require('./queues');
const {print} = require("./globals");

const scrapeTradeAds = () => new Promise(resolve => {
    superagent('GET', 'www.rolimons.com/tradeadsapi/getrecentads')
        .set('user-agent', 'qtb v3')
        .then(resp => {
            if (!resp || !resp.body || !resp.body.trade_ads) return resolve();

            for (const tradead of resp.body.trade_ads) {
                const timePosted = tradead[1];
                const userId = tradead[2];
                const username = tradead[3];

                const offering = tradead[4];
                const requesting = tradead[5];

                queues.queuePlayer({
                    id: userId,
                    username,
                    priority: timePosted * 2,
                    blacklist: [],

                    priorityOffer: requesting.items || [],
                    priorityRequest: offering.items || []
                })
            }

            resolve();
        })
        .catch(() => {
            print(`failed to fetch trade ads from rolimons`, 'error')
            resolve();
        })
})

module.exports = {
    scrapeTradeAds
}