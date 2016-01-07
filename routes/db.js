var logger = require('log4js').getLogger("db");
var async = require('async');
var config = require('../config.json');

//MongoDB configurations
var mongoCollections = ['users', 'items', 'comments'];
var mongoClient = require('mongodb').MongoClient;
var mongoInstance;

// Use connect method to connect to the Server
function initMongoDB(next) {
  mongoClient.connect(config.mongoUrl, config.mongoConfig, function (err, db) {
    logger.info('Init Mongo...');
    if (err)
      logger.fatal('MongoDB connection error : ' + err);
    else if (db) {
      logger.info('MongoDB connect success : ' + config.mongoUrl);
      logger.info('MongoDB check collections...' + config.mongoUrl);
      module.exports.mongo = db;
      //logger.debug(module.exports.mongo);
      async.each(mongoCollections, function (collection, callback) {
        db.collection(collection, { strict: true }, function (err, col3) {
          if (err) {
            logger.warn('Collection ' + collection + ' do not exist.');
            db.createCollection(collection, function (err, result) {
              logger.info('Create collection ' + collection);
              if (err) {
                logger.fatal('Collection ' + collection + ' creation failed.');
                callback(err);
              } else {
                logger.info('Collection ' + collection + ' created.');
                callback();
              }
            });
          } else if (col3) {
            logger.info('Collection ' + collection + ' OK.');
            callback();
          }
        });
      }, function (err, result) {
        if (err)
          logger.error('MongoDB init error : ' + err);
        else
          logger.info('MongoDB init finished.');
      });
    }
    if (next)
      next();
  });
}

function finalizeMongoDB(next) {
  module.exports.mongo.close();
  if (next)
    next();
}
module.exports.init = initMongoDB;
module.exports.finalize = finalizeMongoDB;
  
//Redis configuration
var redisClient = require('redis').createClient(config.redisPort, config.redisServer);

redisClient.on("error", function (error) {
  logger.error(error);
});

module.exports.redis = redisClient;



