const superagent = require('superagent');
const roblox = require('./roblox');
const queues = require('./queues');

const {
    MessageEmbed
} = require('discord.js');
const {fancy, diff} = require("./globals");
const {options} = require("./config");

const baseEmbed = () =>
    new MessageEmbed()
        .setColor('GOLD')
        .setFooter({
            text: `${queues.getTradeQueue().length.toLocaleString()} tr#des queued`,
            iconURL: 'https://quaid.mx/assets/x512.png'
        })
        .setTimestamp();

const sendMessage = (body, webhook) => {
    superagent('POST', webhook || options().discord["outbound webhook url"])
        .set('content-type', 'application/json')
        .send(body)
        .then(() => {})
        .catch(err => {
            console.error(err);
        });
}

const testOfferingMessage = (itemsOffering, itemsRequesting, tradeType, player) => {
    const render = renderItems(itemsOffering, itemsRequesting, options().discord["show custom values"]);

    const percentValueGain = diff(render.valueOffering, render.valueRequesting);
    const percentRapGain = diff(render.rapOffering, render.rapRequesting);

    const embed = baseEmbed()
        .setDescription(
            `:star: **${tradeType} tr#de sent to [${player.username}](https://rolimons.com/player/${player.id})**\n` +
            `:euro: \`${fancy(render.valueRequesting - render.valueOffering)}\` (\`${fancy(percentValueGain)}%\`) \n` +
            `:dollar: \`${fancy(render.rapRequesting - render.rapOffering)}\` (\`${fancy(percentRapGain)}%\`)`
        )
        .addFields([{
            name: `:outbox_tray: offering`,
            value: `${render.formattedOffering.join('\n')}`,
            inline: true,
        }, {
            name: `:inbox_tray: requesting`,
            value: `${render.formattedRequesting.join('\n')}`,
            inline: true,
        }])

    const json = embed.toJSON();
    sendMessage({embeds: [json]}, options().discord["outbound webhook url"]);
}

const renderItems = (itemsOffering, itemsRequesting, showCVs = false) => {
    itemsOffering = itemsOffering.sort((a, b) => b.value - a.value);
    itemsRequesting = itemsRequesting.sort((a, b) => b.value - a.value);

    let formattedOffering = [];
    let valueOffering = 0;
    let rapOffering = 0;

    for (const item of itemsOffering) {
        rapOffering += item.rap || 0;

        let value = item.value;
        if (showCVs) value = item.offer || item.value;

        valueOffering += value;

        formattedOffering.push(
            `\`${value.toLocaleString()}\` [${item.name}](https://rolimons.com/item/${item.id})`
        )
    }

    let formattedRequesting = [];
    let valueRequesting = 0;
    let rapRequesting = 0;

    for (const item of itemsRequesting) {
        rapRequesting += item.rap || 0;

        let value = item.value;
        if (showCVs) value = item.request || item.value;

        valueRequesting += value;

        formattedRequesting.push(
            `\`${value.toLocaleString()}\` [${item.name}](https://rolimons.com/item/${item.id})`
        )
    }

    return {
        formattedOffering,
        formattedRequesting,
        valueOffering,
        valueRequesting,
        rapOffering,
        rapRequesting
    }
}

const sendCompleted = (itemsSent, itemsReceived) => {
    const render = renderItems(itemsSent, itemsReceived, options().discord["show custom values"]);

    const percentValueGain = diff(render.valueOffering, render.valueRequesting);
    const percentRapGain = diff(render.rapOffering, render.rapRequesting);

    const embed = baseEmbed()
        .setDescription(
            `:smirk_cat: **completed tr#de found on [${roblox.info().username}](https://rolimons.com/player/${roblox.info().id})**\n` +
            `:euro: \`${fancy(render.valueRequesting - render.valueOffering)}\` (\`${fancy(percentValueGain)}%\`) \n` +
            `:dollar: \`${fancy(render.rapRequesting - render.rapOffering)}\` (\`${fancy(percentRapGain)}%\`)`
        )
        .addFields([{
            name: `:outbox_tray: sent`,
            value: `${render.formattedOffering.join('\n')}`,
            inline: true,
        }, {
            name: `:inbox_tray: received`,
            value: `${render.formattedRequesting.join('\n')}`,
            inline: true,
        }])

    const json = embed.toJSON();
    sendMessage({content: '<@142709738721902592>', embeds: [json]}, options().discord["completed webhook url"]);
}

module.exports = {
    sendMessage,
    sendCompleted,
    testOfferingMessage
}