var logger = require('log4js').getLogger("db"),
    config = require('../config/db.json'),
    async = require('async'),
    _ = require('lodash'),
    mongoose = require('mongoose'),
    redis = require('redis'),
    elasticsearch = require('elasticsearch')

var mongoCollections = ['users', 'items', 'comments']
var initOps = {
    connectMongo: function (callback) {
        mongoose.connect(config.mongoUrl, config.mongoConfig);
        mongoose.connection.on('error', function (err) {
            logger.error('connection error:', err)
        })
        mongoose.connection.on('connecting', function () {
            logger.info('Connecting to MongoDB:', config.mongoUrl)
        })
        mongoose.connection.on('connected', function () {
            logger.info('MongoDB connected:', config.mongoUrl);
        })
        mongoose.connection.on('disconnecting', function () {
            logger.info('Disconnecting from MongoDB:', config.mongoUrl);
        })
        mongoose.connection.on('disconnected', function () {
            logger.info('MongoDB disconnected:', config.mongoUrl);
        })
        mongoose.connection.once('open', function () {
            logger.info('MongoDB check collections...');
            mongoose.connection.db.listCollections().toArray(function (err, cols) {
                _.each(mongoCollections, function (colName) {
                    if (_.find(cols, { 'name': colName })) {
                        logger.info(colName + ' found');
                    } else {
                        mongoose.connection.db.collection(colName);
                        logger.info(colName + ' created');
                    }
                })
                callback(null, mongoose)
            });
        });
    },
    connectRedis: ['connectMongo', function (callback) {
        var redisClient = redis.createClient(config.redisPort, config.redisServer)
        redisClient.on("ready", function (error) {
            logger.info("Redis ready:", config.redisServer, config.redisPort)
        })
        redisClient.on("connect", function (error) {
            logger.info("Redis connected:", config.redisServer, config.redisPort)
        })
        redisClient.on("end", function (error) {
            logger.info("Redis connection closed:", config.redisServer,config.redisPort)
        })
        redisClient.on("error", function (error) {
            callback(error)
        })
        callback(null, redisClient)
    }],
    connectElasticSearch: ['connectMongo', function (callback) {
        var esClient = new elasticsearch.Client({
            host: config.elasticsearch.host
        })
        callback(null, esClient)
    }]
}

async.auto(initOps, function (err, results) {
    if (err)
        logger.error('DB init error:', err);
    else if (results) {
        logger.info("All db connected:",
            results.connectMongo != undefined &&
            results.connectRedis != undefined &&
            results.connectElasticSearch != undefined)
        module.exports.mongo = results.connectMongo
        module.exports.redis = results.connectRedis
        module.exports.es = results.connectElasticSearch
    }
})

process.on('SIGINT', function () {
    mongoose.connection.close(function () {
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
    });
});