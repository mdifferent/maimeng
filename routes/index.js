var express = require('express'),
    router = express.Router(),
    global = require('./global'),
    db = require('./db'),
    async = require('async'),
    error = require('./error'),
    logger = require('log4js').getLogger("index"),
    values = require('../config/values'),
    config = require('../config/db'),
    Model = require('../models/mongoModels'),
    Item = require('../models/mongoModels').Item,
    _ = require('lodash')

function getIndexList(req, res, listName) {
    var startIdx = parseInt(req.query.nextId || 0),
        endIdx = startIdx + parseInt(req.query.numPerPage || config.defaultNumPerPage)
    var getIdList = function (next) {
        db.redis.lrange(listName, startIdx, endIdx - 1,
            function (err, results) {
                if (err) {
                    logger.error(error.message.server.redisReadError + err)
                    next(error.message.client.databaseError)
                } else if (results && results.length > 0) {
                    next(null, results)
                } else {
                    next(error.object.noMoreItem)
                }
            })
    }
    var getItemsFromCache = function (idSets, next) {
        db.redis.mget(idSets, function (err, results) {
            if (err) {
                logger.error(error.message.server.redisReadError + err)
                next(null, idSets, null)
            } else if (results && results.length > 0) {
                var parsedResults = []
                _.forEach(results, function(result) {
                    parsedResults.push(JSON.parse(result))
                })
                next(null, idSets, parsedResults)
            } else {
                next(null, idSets, null)
            }
        })
    }
    var getItemsFromDb = function (idSets, cacheResults, next) {
        var nonHitIds = []
        var idx = 0
        _.forEach(cacheResults, function (res) {
            if (res === null) nonHitIds.push(idSets[idx])
            idx ++
        })
        if (nonHitIds.length > 0) {
            Item.find({ _id: { $in: nonHitIds } }, Model.ItemFieldsForCli)
                .populate('user', Model.UserFieldsForCli)
                .exec(function (err, items) {
                    if (err) {
                        logger.error(error.message.server.mongoQueryError + err);
                        next(error.object.databaseError);
                    } else if (items) {
                        next(null, _.without(_.union(cacheResults, items), null))
                    } else {
                        next(null, cacheResults)
                    }
                })
        } else {
            next(null, cacheResults)
        }
    }
    async.waterfall([getIdList, getItemsFromCache, getItemsFromDb], function (err, results) {
        if (err) res.status(err.status).jsonp({ errorMessage: err.errorMessage })
        else if (results) res.status(200).jsonp({
            data: {
                itemList: results,
                nextId: endIdx,
                pageCount: req.query.pageCount
            }
        })
    })
}   

//最新物品
router.get('/latestItems', function (req, res, next) {
    if ('itemType' in req.query) {
        var listName = req.query.itemType == values.TO_BUY
            ? values.LATEST_BUY_LIST_KEY : values.LATEST_SELL_LIST_KEY
        getIndexList(req, res, listName)
    } else {
        res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired })
    }
});

//推荐物品
router.get('/recommandedItems', function (req, res, next) {
    //TODO
});

//置顶物品
router.get('/topItems', function (req, res, next) {
    if ('itemType' in req.query) {
        var listName = req.query.itemType == values.TO_BUY
            ? values.TOP_BUY_LIST_KEY : values.TOP_SELL_LIST_KEY
        getIndexList(req, res, listName)
    } else {
        res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired })
    }
});

module.exports = router;
