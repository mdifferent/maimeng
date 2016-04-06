var express = require('express'),
    router = express.Router(),
    global =  require('./global'),
    redis = require('./db').redis,
    async = require('async'),
    error = require('./error'),
    logger = require('log4js').getLogger("index"),
    values = require('../config/values')
    
    
function getIndexList(req, res, listName) {
    var getIdList = function (next) {
        redis.lrange(listName,
            req.query.nextId,
            req.query.numPerPage,
            function (err, results) {
                if (err) {
                    logger.error(error.message.server.redisReadError + err)
                    next(error.message.client.databaseError)
                } else if (results) {
                    next(null, results)
                }
            })
    }
    var getItems = function (idSets, next) {
        redis.mget(idSets, function (err, results) {
            if (err) {
                logger.error(error.message.server.redisReadError + err)
                next(null)
            } else if (results) {
                next(null, results)
            }
        })
    }
    //TODO Get item info from mongodb
    async.waterfall([getIdList, getItems], function (err, results) {
        if (err) {
            return res.status(404).jsonp({ errorMessage: err })
        } else if (results) {
            return res.status(200).jsonp({ data: { itemList: results } })
        }
    })
}   

//最新物品
router.get('/latestItems', function (req, res, next) {
    var listName = req.body.itemType == global.itemType.forBuy
        ? values.LATEST_BUY_LIST_KEY : values.LATEST_SELL_LIST_KEY
    getIndexList(listName)
});

//推荐物品
router.get('/recommandedItems', function(req, res, next) {
    //TODO
});

//置顶物品
router.get('/topItems', function (req, res, next) {
    var listName = req.body.itemType == global.itemType.forBuy
        ? values.TOP_BUY_LIST_KEY : values.TOP_SELL_LIST_KEY
    getIndexList(listName)
});

module.exports = router;
