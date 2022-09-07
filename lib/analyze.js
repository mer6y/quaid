const {shuffle, random, clamp} = require('./globals');
const {options} = require('./config');

const findRandomCombo = (myInventory, theirInventory, options, getTradeType, allowedTradeTypes) => {
    const [amountOfItemsToOffer, amountOfItemsToRequest] = getTradeType();

    const shuffledMyInventory = shuffle(myInventory);
    const myItemIds = shuffledMyInventory.map(i => i.id);

    const theirInventoryModified = theirInventory.filter(i => !myItemIds.includes(i.id));
    if (theirInventoryModified.length !== theirInventory.length) return;
    const shuffledTheirInventory = shuffle(theirInventoryModified);

    let itemsOffering = shuffledMyInventory.splice(0, amountOfItemsToOffer);
    let itemsRequesting = shuffledTheirInventory.splice(0, amountOfItemsToRequest);

    const tradingOptions = options.trading;
    let tradeType = 'downgrade';

    if (itemsOffering.length === itemsRequesting.length)
        tradeType = 'mixed';
    else if (itemsOffering.length > itemsRequesting.length)
        tradeType = 'upgrade';

    if (tradeType === 'upgrade') {
        itemsOffering = itemsOffering.sort((a, b) => b.offer - a.offer);
        itemsRequesting = itemsRequesting.sort((a, b) => b.request - a.request);

        if (itemsOffering[0].offer > itemsRequesting[0].request)
            tradeType = 'mixed';
    }

    if (!allowedTradeTypes.includes(tradeType)) return;
    const tradeTypeOptions = tradingOptions[tradeType];

    let valueSending = 0;
    let rapSending = 0;
    for (const item of itemsOffering) {
        if (tradeTypeOptions['apply minimum item value/rap to offering'] &&
            (
                (item.offer < tradeTypeOptions['minimum item value'] ||
                    item.offer > tradeTypeOptions['maximum item value']) ||
                (item.rap < tradeTypeOptions['minimum item rap'] ||
                    item.rap > tradeTypeOptions['maximum item rap'])
            )) return;

        valueSending += item.offer || item.value;
        rapSending += item.rap;
    }

    let valueRequesting = 0;
    let rapRequesting = 0;
    for (const item of itemsRequesting) {
        if (
            (item.request < tradeTypeOptions['minimum item value'] ||
                item.request > tradeTypeOptions['maximum item value']) ||
            (item.rap < tradeTypeOptions['minimum item rap'] ||
                item.rap > tradeTypeOptions['maximum item rap'])
        ) return;

        valueRequesting += item.request || 0;
        rapRequesting += item.rap;
    }

    if (
        tradeTypeOptions['minimum trade value'] > valueRequesting + valueSending ||
        tradeTypeOptions['maximum trade value'] < valueRequesting + valueSending
    ) return;

    let minRequest = tradeTypeOptions['minimum value gain'] * valueSending;
    let maxRequest = tradeTypeOptions['maximum value gain'] * valueSending;
    let minRapRequest = tradeTypeOptions['minimum rap gain'] * rapSending;
    let maxRapRequest = tradeTypeOptions['maximum rap gain'] * rapSending;

    if (
        (valueRequesting >= minRequest && valueRequesting <= maxRequest) &&
        (rapRequesting >= minRapRequest && rapRequesting <= maxRapRequest)
    ) return {
        itemsOffering,
        itemsRequesting,
        valueSending,
        valueRequesting,
        rapSending,
        rapRequesting,
        tradeType,
    }
}

const findCombo = (myInventory, theirInventory) => {
    const cachedOptions = options();
    let allowedTradeTypes = [];

    if (cachedOptions.trading.upgrade.enabled)
        allowedTradeTypes.push('upgrade');
    if (cachedOptions.trading.mixed.enabled)
        allowedTradeTypes.push('mixed');
    if (cachedOptions.trading.downgrade.enabled)
        allowedTradeTypes.push('downgrade');
    if (cachedOptions.trading["upgrade only until below X items"] <= myInventory.length)
        allowedTradeTypes = ['upgrade'];
    else if (cachedOptions.trading["downgrade only until above X items"] >= myInventory.length)
        allowedTradeTypes = ['downgrade'];
    if (!allowedTradeTypes.length)
        allowedTradeTypes = ['upgrade', 'downgrade'];

    const minSendingItems = cachedOptions.trading["minimum amount of items to offer"];
    const maxSendingItems = cachedOptions.trading["maximum amount of items to offer"];
    const minRequestItems = cachedOptions.trading["minimum amount of items to request"];
    const maxRequestItems = cachedOptions.trading["maximum amount of items to request"];

    const clampOffer = (num) => clamp(num, minSendingItems, maxSendingItems);
    const clampRequest = (num) => clamp(num, minRequestItems, maxRequestItems);

    const getTradeType = () => {
        const randomIndex = random(0, allowedTradeTypes.length - 1);
        const tradeType = allowedTradeTypes[randomIndex];

        switch (tradeType) {
            case 'upgrade':
                const sendingUpgrade = random(
                    minSendingItems,
                    maxSendingItems
                ) + 1;
                const requestingUpgrade = random(
                    minRequestItems,
                    sendingUpgrade - 1
                );

                return [
                    clampOffer(sendingUpgrade),
                    clampRequest(requestingUpgrade)
                ]
            case 'mixed':
                const sendingMixed = random(
                    minSendingItems,
                    maxSendingItems
                )

                return [
                    clampOffer(sendingMixed),
                    clampRequest(sendingMixed)
                ]
            case 'downgrade':
                const requestingDowngrade = random(
                    minRequestItems,
                    maxRequestItems
                ) + 1;
                const sendingDowngrade = random(
                    minSendingItems,
                    requestingDowngrade - 1
                );

                return [
                    clampOffer(sendingDowngrade),
                    clampRequest(requestingDowngrade)
                ]
        }
    }

    for (let i = 0; i < 10000; i++) {
        const combo = findRandomCombo(
            [...myInventory], [...theirInventory],
            cachedOptions, getTradeType, allowedTradeTypes
        );

        if (combo) return combo;
    }
}

module.exports = {
    findCombo
};