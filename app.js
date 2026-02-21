const config                = require('./config/index.config.js');
const Cortex                = require('ion-cortex');
const ManagersLoader        = require('./loaders/ManagersLoader.js');
const mongoose              = require('mongoose');

process.on('uncaughtException', err => {
    console.log(`Uncaught Exception:`);
    console.log(err, err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled rejection at ', promise, `reason:`, reason);
    process.exit(1);
});

async function startServer() {
    try {
        await mongoose.connect(config.dotEnv.MONGO_URI);
        console.log('💾 MongoDB connected successfully');

        const cache = require('./cache/cache.dbh')({
            prefix: config.dotEnv.CACHE_PREFIX,
            url: config.dotEnv.CACHE_REDIS
        });

        const cortex = new Cortex({
            prefix: config.dotEnv.CORTEX_PREFIX,
            url: config.dotEnv.CORTEX_REDIS,
            type: config.dotEnv.CORTEX_TYPE,
            state: () => {
                return {};
            },
            activeDelay: "50ms",
            idlDelay: "200ms",
        });

        const managersLoader = new ManagersLoader({ config, cache, cortex });
        const managers = managersLoader.load();

        managers.userServer.run();

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
