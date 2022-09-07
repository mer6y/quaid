const workers = {};

/**
 * Planned to use node.js workers before,
 * but they didn't provide enough performance
 * to justify the complexity of using them.
 */

const startWorkers = () => {
    workers.outbounds = require('./outbounds')();
    workers.playerqueue = require('./playerqueue');
    workers.tradequeue = require('./tradequeue');
}

module.exports = {
    startWorkers,
}
