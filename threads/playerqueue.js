const queues = require('../lib/queues');
const database = require('../lib/database');
const roblox = require('../lib/roblox');
const analyze = require('../lib/analyze')
const {print, sleep} = require("../lib/globals");
const discord = require('../lib/discord');
const {options} = require("../lib/config");
const chalk = require("chalk");

const completePlayerQueue = async () => {
    if (queues.getTradeQueue().length > 20) {
        // print('queue is over 200, skipping', 'debug');
        return setTimeout(completePlayerQueue);
    }

    const player = queues.nextInPlayerQueue();
    if (!player) return setTimeout(completePlayerQueue);

    const isOnCooldown = await database.isOnCooldown(player.id);

    if (isOnCooldown) {
        // print(`sent to ${player.username} too recently! skipping..`, 'error')
        return setTimeout(completePlayerQueue);
    }

    if (!await roblox.canTradeWith(player.id)) {
        print(`sent to ${player.username} has trades disabled! skipping..`, 'error')
        return setTimeout(completePlayerQueue);
    }

    const myFullInventory = roblox.info().inventory;
    const theirFullInventory = await roblox.getInventory(player.id);
    const theirTradableInventory = [];

    if (myFullInventory.length < 1) {
        print(`you have no tr#dable items`, 'error')
        return setTimeout(completePlayerQueue);
    }

    let copiesOwned = {};
    let myMaxRequest = 0;
    for (const item of myFullInventory) {
        myMaxRequest += item.offer || item.value;
        if (!copiesOwned[item.id])
            copiesOwned[item.id] = 0;
        copiesOwned[item.id]++;
    }

    for (const item of theirFullInventory) {
        if (!item.whitelist.request) continue;
        if (player.blacklist.includes(item.uaid)) continue;
        // if (item.request > myMaxRequest) continue;
        if (copiesOwned[item.id] && options().items["max hoard"] >= copiesOwned[item.id])
            continue;

        theirTradableInventory.push(item);
    }

    if (theirTradableInventory.length < 1) {
        print(`${player.username} has no tr#dable items`, 'debug')
        return setTimeout(completePlayerQueue);
    }

    const playerQueueLength = queues.getPlayerQueue().length;
    print(`searching for tr#des with ${player.username} (${playerQueueLength.toLocaleString()} players in queue)`, 'debug');

    let combo;
    if (player.priorityOffer) {
        const matchesPriorityOffering = myFullInventory.filter(i => player.priorityOffer.includes(i.id));
        const matchesPriorityRequest = myFullInventory.filter(i => player.priorityOffer.includes(i.id));

        // console.log('finding priority combos from trade ad', matchesPriorityOffering.length, matchesPriorityRequest.length)

        if (matchesPriorityOffering.length && matchesPriorityRequest.length)
            combo = analyze.findCombo(matchesPriorityOffering, matchesPriorityRequest);
        else if (matchesPriorityOffering.length)
            combo = analyze.findCombo(matchesPriorityOffering, theirTradableInventory);
    }

    if (!combo)
        combo = analyze.findCombo(myFullInventory, theirTradableInventory);

    if (!combo) {
        print(`couldn't find a tr#de with ${player.username}`, 'debug');
        await database.setPlayerCooldown(player.id, 1)
        return setTimeout(completePlayerQueue);
    }

    const priority = await roblox.lastOnline(player.id);

    queues.queueTrade({
        itemsOffering: combo.itemsOffering,
        itemsRequesting: combo.itemsRequesting,
        player,
        tradeType: combo.tradeType,
        priority: priority,
    })

    const fancyTradeOutput =
        chalk.blueBright(
            `found a${combo.tradeType === 'upgrade' ? 'n' : ''} `
        ) + chalk.cyanBright(`${combo.tradeType}`) +
        chalk.blueBright(` tr#de with ${player.username} (${queues.getTradeQueue().length.toLocaleString()} tr#des queued)\n`) +
        chalk.blueBright(`offering [`) +
        chalk.gray(combo.itemsOffering.map(i => `${i.name} (${i.value})`).join(', ')) +
        chalk.blueBright(`] for [`) +
        chalk.gray(combo.itemsRequesting.map(i => `${i.name} (${i.value})`).join(', ')) +
        chalk.blueBright(`] `) +
        chalk.cyanBright(`(${combo.valueSending.toLocaleString()} vs ${combo.valueRequesting.toLocaleString()})`);

    print(fancyTradeOutput);
    // print(`queued a(n) ${combo.tradeType} tr#de for ${player.username} (${combo.valueSending.toLocaleString()} v ${combo.valueRequesting.toLocaleString()})`, 'info')

    return setTimeout(completePlayerQueue);
};

const main = async () => {
    for (let i = 0; i < 30; i++) {
        completePlayerQueue().then();
        await sleep(100);
    }
}

main();