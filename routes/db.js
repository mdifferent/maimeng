var logger = require('log4js').getLogger("db");
var async = require('async');
var config = require('../config/db.json');

//Redis configuration
var redisClient = require('redis').createClient(config.redisPort, config.redisServer);

redisClient.on("error", function (error) {
  logger.error(error);
});

module.exports.redis = redisClient;