const aes256 = require('aes256');
const {options} = require('./config');

const key = '...';

const discordId = options().authentication['discord id'];
const regularCipher = aes256.createCipher(key);
const cipher = aes256.createCipher(key + discordId);

const encrypt = (object, keybased = false) => {
    try {
        return keybased ?
            cipher.encrypt(JSON.stringify(object)) :
            regularCipher.encrypt(JSON.stringify(object));
    } catch (e) {
        return null;
    }
}

const decrypt = (string, keybased = false) => {
    try {
        return JSON.parse(keybased ?
            cipher.decrypt(string) :
            regularCipher.decrypt(string));
    } catch (e) {
        return null;
    }
}

module.exports = {
    encrypt, decrypt
}