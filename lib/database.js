const {Sequelize, DataTypes} = require('sequelize');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.kwade',
    logging: false,
});

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
    },
    timeAdded: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    timeFree: {
        type: DataTypes.DATE,
        allowNull: false
    }
})
const OutboundTrade = sequelize.define('OutboundTrade', {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
    },
    partnerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    rawJSON: {
        type: DataTypes.JSON,
        allowNull: false,
    },

    tradeType: {
        type: DataTypes.STRING,
    }
})

const connect = async () => {
    await sequelize.authenticate();
    await sequelize.sync({alter: true});
}
const getOutbounds = async () => OutboundTrade.findAll();
const setOutbound = async (id, player, tradeData, tradeType) => OutboundTrade.create({
    id,
    partnerId: player.id,
    rawJSON: tradeData,
    tradeType
});
const clearOutbound = async (id) => OutboundTrade.destroy({
    where: {id}
})

const isOnCooldown = async (userId) => {
    userId = Number(userId)

    try {
        const inDb = await User.findOne({
            where: {id: userId}
        });

        if (!inDb) return false;
        return inDb.timeFree.getTime() > Date.now();
    } catch (e) {
        console.error(e);
        return false;
    }
}
const setPlayerCooldown = async (userId, hours) => {
    userId = Number(userId);

    const hoursInMs = hours * 60 * 60 * 1000;

    try {
        const inDb = await User.findOne({
            where: {id: userId}
        })

        if (!inDb) await User.create({
            id: userId,
            timeAdded: Date.now(),
            timeFree: Date.now() + hoursInMs,
        })
        else await User.update({
            timeAdded: Date.now(),
            timeFree: Date.now() + hoursInMs,
        }, {where: {id: userId}})
    } catch (e) {
        console.error('failed to add entry for player', e);
    }
}
const clearPlayerCooldown = async (userId) => {
    userId = Number(userId);

    try {
        await User.destroy({
            where: {id: userId}
        })
    } catch (e) {
        console.error('failed to clear cooldown', e)
    }
}

module.exports = {
    connect,
    getOutbounds,
    setOutbound,
    clearOutbound,

    isOnCooldown,
    clearPlayerCooldown,
    setPlayerCooldown,

    models: sequelize.models,
}