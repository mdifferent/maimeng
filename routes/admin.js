var express = require('express'),
    router = express.Router(),
    logger = require('log4js').getLogger("admin"),
    error = require('./error'),
    redis = require('./db').redis,
    Model = require('../models/mongoModels'),
    Item = require('../models/mongoModels').Item,
    User = require('../models/mongoModels').User,
    values = require('../config/values')

module.exports = router;

//发送通知
router.post('/SendMessage', function (req, res) {
	
});

//下架商品
router.post('/DisableItem', function (req, res) {
	
});

//审核商品
router.post('/AuditItem', function (req, res) {
	
});

//锁定账户
router.post('/BlockUser', function (req, res) {
	
});

//置顶商品
router.post('/SetItemToTop', function (req, res) {
    var listName = req.body.itemType == values.TO_BUY
        ? values.TOP_BUY_LIST_KEY : values.TOP_SELL_LIST_KEY
    if (req.body.itemId && req.body.itemScore) {
        redis.zadd(listName, req.body.itemId, req.body.itemScore)
        Item.findById(req.body.itemId, Model.ItemFieldsForCli)
            .populate('user', Model.UserFieldsForCli)
            .exec(function (err, item) {
                if (err) {
                    logger.error(error.message.server.mongoQueryError + err)
                    res.status(500).jsonp({ errorMessage: error.message.client.databaseError })
                } else if (item) {
                    redis.set(req.body.itemId, item.toJSON({ versionKey: false }));
                    res.status(201).end()
                }

            });
    } else {
        return res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired })
    }
})

//移除置顶商品
router.post('/RemoveItemFromTop', function (req, res) {
    var listName = req.body.itemType == values.TO_BUY
        ? values.TOP_BUY_LIST_KEY : values.TOP_SELL_LIST_KEY
    if (req.body.itemId) {
        redis.multi()
            .zrem(listName, req.body.itemId)
            .del(req.body.itemId)
            .exec(function (err, replies) {
                if (err) {
                    logger.error(error.message.server.redisWriteError + err);
                } else if (replies && replies[0] == 1) {
                    logger.info("Cache item removed:" + req.body.itemId)
                }
            })
        res.status(201).end()
    } else {
        return res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired })
    }
})