const chalk = require('chalk');

module.exports = {
    print: (string, type = 'none') => {
        const fancyTime = new Date().toLocaleTimeString();
        const timeWithColors = chalk.yellowBright(`[${fancyTime}]`);
        let typeAddon = '';

        if (!type) return console.log(
            timeWithColors,
            string.split('\n').join('\n' + ' '.repeat(fancyTime.length + 3))
        )

        switch (type) {
            case 'error':
                typeAddon = chalk.redBright(`[error]`)
                string = chalk.redBright(string);
                break;
            case 'success':
                typeAddon = chalk.greenBright(`[success]`)
                string = chalk.greenBright(string);
                break;
            case 'info':
                typeAddon = chalk.blueBright(`[info]`)
                string = chalk.blueBright(string);
                break;
            case 'warn':
                typeAddon = chalk.yellowBright(`[warn]`);
                string = chalk.yellowBright(string);
                break;
            case 'debug':
                typeAddon = chalk.gray(`[debug]`)
                string = chalk.gray(string);
                break;
        }

        return console.log(
            timeWithColors,
            // typeAddon,
            string.split('\n').join('\n' + ' '.repeat(fancyTime.length + 3))
        )
    },
    shuffle: array => {
        for (let i = 0; i < 5; i++)
            array = module.exports.primaryShuffle(array)
        return array;
    },
    primaryShuffle: array => array.sort(() => 0.5 - Math.random()),
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    random: (min, max) => {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1) + min);
    },
    clamp: (num, min = 1, max = 4) => Math.min(Math.max(num, min), max),
    fancy: (num) => (num < 0 ? '' : '+') + num.toLocaleString(),
    diff: (offer, request) => Math.round((request - offer) / offer * 10000) / 100
}