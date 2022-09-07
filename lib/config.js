const fs = require('fs');
const {print} = require("./globals");

let parsedConfig = {};
let whitelistBody = {};

let rawPersonalCustomValues = '';

let currentProxyPos = 0;
let proxies = [];

const parseConfig = () => {
    try {
        const rawText = fs.readFileSync('./config/config.json').toString();
        parsedConfig = JSON.parse(rawText);
    } catch (e) {
        console.error(e);
        print(`failed to read your config.json file. please put it into https://jsonlint.com/ and make sure it's properly formatted!`, 'error')
        return process.exit();
    }
}
const parseRawCustomValues = () => {
    let rawValues;
    try {
        rawValues = fs.readFileSync('./config/custom_values.txt')
            .toString().replace(/\r/g, '').trim().split('\n');
    } catch (e) {
        console.error(e);
        print(`failed to read your custom_values.txt file. please make sure it exists!`, 'error');
        return process.exit();
    }

    rawPersonalCustomValues = rawValues || rawPersonalCustomValues;
}
const parseProxies = () => {
    let rawProxies;
    try {
        rawProxies = fs.readFileSync('./config/proxies.txt').toString();
    } catch (e) {
        console.error(e);
        print(`failed to read your proxies.txt file. please make sure it exists!`, 'error');
        return process.exit();
    }

    rawProxies = rawProxies.replace(/\r/g, '')
        .trim()
        .replace(/http:\/\//g, '')
        .split('\n');

    proxies = [];
    for (const proxy of rawProxies) {
        if (!proxy.includes('@')) {
            const parts = proxy.split(':');
            if (parts.length > 2)
                proxies.push(`${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`)
            else proxies.push(proxy);
        } else proxies.push(proxy);
    }
}

const firstTimeParseAll = () => {
    print('reading internal values...', 'debug')

    parseConfig();
    parseRawCustomValues();
    parseProxies();

    fs.watchFile(`./config/config.json`, () => {
        print(`detected config.json change, updated options`, 'success');
        parseConfig();
    })
}

firstTimeParseAll();

module.exports = {
    firstTimeParseAll,

    getPersonalCustomValues: () => {
        parseRawCustomValues();
        return rawPersonalCustomValues;
    },

    options: () => parsedConfig,

    getProxy: (pos) => {
        currentProxyPos++;
        if (currentProxyPos >= proxies.length)
            currentProxyPos = 0;

        return `http://${proxies[pos || currentProxyPos]}`;
    },

    setWhitelistBody: body => whitelistBody = body,
    getWhitelistBody: () => whitelistBody
}