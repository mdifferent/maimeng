var async = require('async'),
    _ = require('lodash'),
    express = require('express'),
    router = express.Router(),

    logger = require('log4js').getLogger("item"),
    global =  require('./global'),
    error = require('./error'),
    Model = require('../models/mongoModels'),
    Item = require('../models/mongoModels').Item,
    User = require('../models/mongoModels').User,
    db = require('./db'),
    dbConfig = require('../config/db'),
    values = require('../config/values')
 
/************************************************
 * 发布物品
 ***********************************************/
function addItemCommon(req, res, next) {
    if (req.body.name && req.body.price) {
        var data = req.body;
        data.loginId = undefined;
        data.user = req.loginUser._id;
        data.disable = false;
        /*
        var newItem = new Item(data)
        newItem.save(function (err) {
            if (err) {
                logger.error(error.message.server.mongoInsertError + err);
                res.status(500).jsonp({ errorMessage: error.message.client.databaseError })
            } else {
                newItem.on('es-indexed', function (err, res) {
                    if (err) {
                        logger.error(error.message.server.mongoInsertError + err);
                        res.status(500).jsonp({ errorMessage: error.message.client.databaseError })
                    }
                    next()
                });
            }
        })*/
        Item.create(data, function (err, item) {
            item.on('es-indexed', function(err, result) {
                if (err)
                    logger.error(err)
                else
                    logger.info("Item indexed:") 
            });
            if (err) {
                logger.error(error.message.server.mongoInsertError + err);
                res.status(500).jsonp({ errorMessage: error.message.client.databaseError })
            } else if (item) {
                User.populate(item, { path: 'user', select: Model.UserFieldsForCli },
                    function (err, item) {
                        if (err)
                            logger.error(error.message.server.mongoQueryError + err);
                        res.status(201).jsonp({ data: { 
                            item: item.toJSON({ versionKey: false })
                        } })
                        res.item = item //used for caching
                        next();
                    });
            }
        });
    } else {
        res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired })
        next();
    }
}

//
function cacheItem(req, res, next) {
    //logger.debug("cacheItem", res.item)
    var listName = req.body.type == values.TO_BUY
        ? values.LATEST_BUY_LIST_KEY : values.LATEST_SELL_LIST_KEY
    if (db.redis.llen(listName) === dbConfig.cacheListMaxLen)
        db.redis.rpop(listName)
    db.redis.multi()
        .lpush(listName, res.item.id)
        .setex(res.item.id, dbConfig.itemCacheTime, JSON.stringify(res.item.toJSON({ versionKey: false })))
        .exec(function(err, replies) {
            if (err) {
                logger.error(error.message.server.redisWriteError + err);
            } else if (replies) {
                logger.info("Latest list length:" + replies[0])
                logger.info("Cache item info:" + replies[1])
            }
        })
    delete res.item
    if (next)
        next()
}

//发布物品
router.post('/addItem', global.checkSession, global.decryptOnRequest, function (req, res, next) {
    req.body.type = values.TO_SELL
    addItemCommon(req, res, next)
}, cacheItem);

//发布求物
router.post('/addItemRequest', global.checkSession, global.decryptOnRequest, function (req, res, next) {
    req.body.type = values.TO_BUY
    addItemCommon(req, res, next)
}, cacheItem);


/************************************************
 * 修改物品
 ***********************************************/
var updateItemCallback = function (req, res, next) {
    return function (err, item) {
        if (err) {
            logger.error(error.message.server.mongoUpdateError + err);
            res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
        } else if (item) {
            User.populate(item, { path: 'user', select: Model.UserFieldsForCli },
                function (err, item) {
                    if (err)
                        logger.error(error.message.server.mongoQueryError + err);
                    res.status(201).jsonp({ data: { item: item.toJSON({ versionKey: false }) } });
                    if (next)
                        next()
                });
        }
    }
}

//更新缓存中的物品信息
var updateItemCache = function (req, res, next) {
    if (res.status === 201 && res.body.data) {
        if (db.redis.exists(req.body.itemId)) {
            db.redis.set(req.body.itemId, res.body.data.item)
            db.redis.expire(req.body.itemId, dbConfig.itemCacheTime)
        }
    }
    if (next)
        next()
}

//修改物品信息
router.post('/modifyItem', global.checkSession, global.decryptOnRequest, function (req, res, next) {
    logger.debug(req.body);
    var itemId = req.body.itemId;
    var updateData = req.body;
    updateData.loginId = undefined;
    updateData.itemId = undefined;
    updateData.updateTime = Date.now();
    Item.findOneAndUpdate({ _id: itemId, user: req.loginUser._id },
        updateData, { new: true },
        updateItemCallback(req, res, next));
}, updateItemCache);

//使物品失效
router.post('/disableItem', global.checkSession, global.decryptOnRequest, function (req, res) {
    Item.findOneAndUpdate({ _id: req.body.itemId, user: req.loginUser._id }, 
        { disabled: true, updateTime : Date.now() }, { new: true },
        updateItemCallback(req, res));
    db.redis.del(req.body.itemId)
});

/************************************************
 * 获取物品信息
 ***********************************************/
//尝试从缓存中获取物品信息
function checkCache(req, res, next) {
    logger.debug('itemId in redis:', req.params.itemId)
    if (req.params.itemId) {
        var item = db.redis.get(req.params.itemId)
        if (item)
            return res.status(200).jsonp({ data: { item: item } })
        else
            next()
    } else {
        return res.status(400).jsonp({ errorMessage: '缺少itemId' });
    }
}

router.get('/getItemDetail/:itemId', checkCache, function (req, res) {
    logger.debug('itemId:', req.params.itemId)
    if (req.params.itemId) {
        Item.findByIdAndUpdate(req.params.itemId,
            { $inc: { visitCount: 1 } },
            { new: true, select: Model.ItemFieldsForClie })
            .populate('user', Model.UserFieldsForCli)
            .exec(function (err, item) {
                if (err) {
                    logger.error(error.message.server.mongoQueryError + err);
                    return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
                } else if (item) {
                    return res.status(200).jsonp({ data: { item: item.toJSON({ versionKey: false }) } });
                }
            });
    } else {
        return res.status(400).jsonp({ errorMessage: '缺少itemId' });
    }
});

/************************************************
 * 物品列表
 ***********************************************/
function listCommonOperation(req, res, itemType) {
    if (req.query.userId || req.loginUser) {
        var query = Item.find({
            user: req.query.userId || req.loginUser._id,
            type: parseInt(itemType)
        });
        if (req.query.nextId)
            query.where('_id').gt(req.query.nextId);
        query.select(Model.ItemFieldsForCli);
        query.sort({ '_id': 1 }).limit(parseInt(req.query.numPerPage));
        query.populate('user', Model.UserFieldsForCli);
        query.exec(function (err, items) {
            if (err) {
                logger.error(error.message.server.mongoQueryError + err);
                return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
            } else if (items) {
                _.each(items, function (item) {
                    item.descriptionSummary = item.descriptionContent.substr(0, 30);
                    item.descriptionContent = undefined;
                });
                return res.status(200).jsonp({
                    data: {
                        nextId: items.slice(-1)._id,
                        pageCount: req.query.pageCount,
                        itemList: items
                    }
                });
            }
        });
    } else {
        res.status(400).jsonp({ errorMessage: error.object.fieldRequired });
    }
}

//获取用户发布的物品列表
router.get('/getUserItemList', function(req, res) {
	listCommonOperation(req, res, values.TO_SELL);
});

//获取用户发布的求物列表
router.get('/getUserItemRequestList', function(req, res) {	
	listCommonOperation(req, res, values.TO_BUY);
});


/********************************************
*收藏夹
*********************************************/
function favorateCommonCallback(res) {
    return function (err, result) {
        if (err)
            return res.status(err.status).jsonp({ errorMessage: err.errorMessage });
        else if (result)
            return res.status(201).jsonp({ data: { item: result } });
        else
            return res.status(500).jsonp({ errorMessage: error.message.noUpdate });
    };
};

//更改用户的收藏夹
function toggleFavorite(toAdd) {
    return function (item, userId, next) {
        var itemId = item._id;
        var condition = toAdd
            ? { _id: userId, favorites: { $nin: [itemId] } }
            : { _id: userId, favorites: itemId }
        var operation = toAdd 
            ? { $addToSet: { favorites: itemId } } 
            : { $pull: { favorites: itemId } };
        User.update(condition, operation, function (err, user) {
            if (err) {
                logger.error(error.message.server.mongoUpdateError + err);
                next(error.object.databaseError);
            } else if (user) {
                next(null, item);
            } else {
                var errorObj = toAdd
                    ? error.object.duplicateFavor 
                    : error.object.favorNotExist
                next(errorObj)
            }
        });
    };
};

//获取Item对象
function getItem(itemId, userId) {
    logger.debug("getItem:userId", userId)
    return function (next) {
        Item.findById(itemId, Model.ItemFieldsForCli)
            .populate('user', Model.UserFieldsForCli)
            .exec(function (err, item) {
                if (err) {
                    logger.error(error.message.internal.mongoQueryError + err);
                    next(error.object.databaseError);
                } else if (item) {
                    //验证是否收藏自己发布的物品
                    logger.debug("getItem:", item)
                    if (item.user._id.toString() === userId)
                        next(error.object.favorateSelf);
                    else
                        next(null, item, userId);
                } else {
                    next(error.object.itemNotFound);
                }
            });
    }
};

//收藏物品
router.post('/addItemToFavorite', global.checkSession, global.decryptOnRequest, function (req, res) {
    if (req.body.itemId)
        async.waterfall([getItem(req.body.itemId, req.loginUser._id),
            toggleFavorite(true)], favorateCommonCallback(res));
    else
        res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired });
});

//取消收藏
router.post('/removeItemFromFavorite', global.checkSession, global.decryptOnRequest, function (req, res) {
    if (req.body.itemId)
        async.waterfall([getItem(req.body.itemId, req.loginUser._id),
            toggleFavorite(false)], favorateCommonCallback(res));
    else
        res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired });
});

//获取我收藏的物品列表
router.get('/getMyFavoriteItemList', global.checkSession, global.decryptOnRequest, function(req, res) {
    var getItemIds = function(next) {
        User.findById(req.loginUser._id, 'favorites')
            .exec(function(err, user) {
            if (err) {
                logger.error(error.message.server.mongoQueryError + err);
                next(error.object.databaseError);
                return res.status(500).jsonp({errorMessage:error.message.client.databaseError});
            } else if (user) {
                var startIdx = req.query.nextId 
                    ? (_.findIndex(user.favorites, function(favorite) { 
                        return favorite._id.toString() === req.query.nextId;}) + 1) 
                    : 0;
                var items = req.query.numPerPage
                    ? _.slice(user.favorites, startIdx, startIdx + parseInt(req.query.numPerPage))
                    : user.favorites;
                next(null, items);
            }
        });
    };
    var getItems = function (itemIds, next) {
        Item.find({ _id: { $in: itemIds } }, Model.ItemFieldsForCli)
            .populate('user', Model.UserFieldsForCli)
            .exec(function (err, items) {
                if (err) {
                    logger.error(error.message.server.mongoQueryError + err);
                    next(error.object.databaseError);
                } else if (items) {
                    next(null, items);
                } else {
                    next(error.object.itemNotFound);
                }
            });
    }
    async.waterfall([getItemIds, getItems], function(err, results) {
        if (err) {
            return res.status(err.status).jsonp({errorMessage:err.errorMessage});
        } else if (results) {
            var nextId = null
            if (results.length > 0)
                nextId: results.slice(-1)._id
            return res.status(200).jsonp({
                data:{
                    nextId: nextId, 
                    pageCount:req.query.pageCount, 
                    itemList:results
                }
           });            
        }
    })
});

module.exports = router;