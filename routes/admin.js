var express = require('express');
var router = express.Router();
var logger = require('log4js').getLogger("admin");
var error = require('./error');
var redis = require('./db').redis;
var Model = require('../models/mongoModels');
var Item = require('../models/mongoModels').Item;
var User = require('../models/mongoModels').User;

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
    if (req.body.itemId && req.body.itemScore) {
        redis.zadd('topList', req.body.itemId, req.body.itemScore)
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
    if (req.body.itemId) {
        redis.zrem('topList', req.body.itemId)
        redis.del(req.body.itemId)
        res.status(201).end()
    } else {
        return res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired })
    }
})