var async = require('async');
var _ = require('lodash');
var express = require('express');
var router = express.Router();

var logger = require('log4js').getLogger("item");
var global =  require('./global');
var error = require('./error');
var Model = require('../models/mongoModels');
var Item = require('../models/mongoModels').Item;
var User = require('../models/mongoModels').User;
var redis = require('./db').redis;
var dbConfig = require('../config/db')

/************************************************
 * 发布物品
 ***********************************************/
function addItemCommon(req, res, next) {
    if (req.body.name && req.body.price) {
        var data = req.body;
        delete data.loginId;
        data.user = req.loginUser._id;
        data.disable = false;
        Item.create(data, function (err, item) {
            if (err) {
                logger.error(error.message.server.mongoInsertError + err);
                res.status(500).jsonp({ errorMessage: error.message.client.databaseError })
            } else if (item) {
                User.populate(item, { path: 'user', select: Model.UserFieldsForCli },
                    function (err, item) {
                        if (err)
                            logger.error(error.message.server.mongoQueryError + err);
                        res.status(201).jsonp({ data: { 
                            item: item.toJSON({ versionKey: false }),
                            itemId: item.id()
                        } })
                        next();
                    });
            }
        });
    } else {
        res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired })
        next();
    }
}

function cacheItem(req, res, next) {
    var listName = req.body.itemType == global.itemType.forBuy
        ? 'latestBuyList' : 'latestSellList'
    if (redis.llen(listName) === dbConfig.cacheListMaxLen)
        redis.rpop(listName)
    redis.lpush(listName, res.body.data.itemId)
    redis.set(res.body.data.itemId, res.body.data.item)
    redis.expire(res.body.data.itemId, 24 * 3600)
    next()
}

//发布物品
router.post('/addItem', global.checkSession, global.decryptOnRequest, function (req, res, next) {
    req.body.itemType = global.itemType.forSell
    addItemCommon(req, res, next)
}, cacheItem);

//发布求物
router.post('/addItemRequest', function (req, res, next) {
    req.body.itemType = global.itemType.forBuy
    addItemCommon(req, res, next)
}, cacheItem);


/************************************************
 * 修改物品
 ***********************************************/
function updateItemCallback (req, res, next) {
    return function (err, item) {
        if (err) {
            logger.error(error.message.server.mongoUpdateError + err);
            res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
        } else if (item) {
            User.populate(item, { path: 'user', select : Model.UserFieldsForCli }, 
                function (err, item) {
                    if (err)
                        logger.error(error.message.server.mongoQueryError + err);
                    res.status(201).jsonp({data: { item: item.toJSON({ versionKey: false }) }});
                    next()
            });
        }
    }
}

//更新缓存中的物品信息
function updateItemCache(req, res, next) {
    if (res.status === 201 && res.body.data) {
        if (redis.exists(req.body.itemId)) {
            redis.set(req.body.itemId, res.body.data.item)
            redis.expire(req.body.itemId, dbConfig.itemCacheTime)
        }
    }
    next()
}

//修改物品信息
router.post('/modifyItem', global.checkSession, global.decryptOnRequest, function (req, res, next) {
    logger.debug(req.body);
    var itemId = req.body.itemId;
    var updateData = req.body;
    delete updateData.loginId;
    delete updateData.itemId;
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
    redis.del(req.body.itemId)
});

/************************************************
 * 获取物品信息
 ***********************************************/
//尝试从缓存中获取物品信息
function checkCache(req, res, next) {
    if (req.query.itemId) {
        var item = redis.get(req.query.itemId)
        if (item)
            return req.status(200).jsonp({data:{item:item}})
        else
            next()
    } else {
		return res.status(400).jsonp({errorMessage:'缺少itemId'});
	}
}

router.get('/getItemDetail', checkCache, function(req, res) {
	if (req.query.itemId) {
		Item.findById(req.query.itemId)
            .select(Model.ItemFieldsForClie)
            .populate('user', Model.UserFieldsForCli)
            .exec(function(err, item) {
                if (err) {
                    logger.error(error.message.server.mongoQueryError + err);
                    return res.status(500).jsonp({errorMessage:error.message.client.databaseError});
                } else if (item) {
                    return res.status(200).jsonp({data:{item : item.toJSON({ versionKey: false })}});
                }
            });
	} else {
		return res.status(400).jsonp({errorMessage:'缺少itemId'});
	}
});

/************************************************
 * 物品列表
 ***********************************************/
function listCommonOperation(req, res, itemType) {
    var query = Item.find({ type: parseInt(itemType) });
    if (req.query.userId)
        query.where('user').equals(req.query.userId);
    else if (req.loginUser)
        query.where('user').equals(req.loginUser._id);
    else
        return res.status(400).jsonp({ errorMessage: error.object.fieldRequired });
    if (req.query.nextId)
        query.where('_id').gt(req.query.nextId);
    query.select(Model.ItemFieldsForCli);
    query.sort({'_id': 1}).limit(parseInt(req.query.numPerPage));
    query.populate('user', Model.UserFieldsForCli);
    query.exec(function (err, items) {
        if (err) {
            logger.error(error.message.server.mongoQueryError + err);
            return res.status(500).jsonp({errorMessage:error.message.client.databaseError});
        } else if (items) {
            _.each(items, function (item) {
                item.descriptionSummary = item.descriptionContent.substr(0, 30);
                delete item.descriptionContent;
            });
            return res.status(200).jsonp({data :{
                nextId:items.slice(-1)[0]._id, 
                pageCount:req.query.pageCount, 
                itemList:items
            }});
        }
    });
}

//获取用户发布的物品列表
router.get('/getUserItemList', function(req, res) {
	listCommonOperation(req, res, global.itemType.forSell);
});

//获取用户发布的求物列表
router.get('/getUserItemRequestList', function(req, res) {	
	listCommonOperation(req, res, global.itemType.forBuy);
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
        var operation = toAdd 
            ? { $addToSet: { favorites: itemId } } 
            : { $pull: { favorites: itemId } };
        User.findByIdAndUpdate(userId, operation, function (err, user) {
            if (err) {
                logger.error(error.message.server.mongoUpdateError + err);
                next(error.object.databaseError);
            } else if (user) {
                next(null, item);
            }
        });
    };
};
//获取Item对象
function getItem(itemId, userId) {
    return function (next) {
        Item.findById(itemId, Model.ItemFieldsForCli)
            .populate('user', Model.UserFieldsForCli)
            .exec(function (err, item) {
                if (err) {
                    logger.error(error.message.internal.mongoQueryError + err);
                    next(error.object.databaseError);
                } else if (item) {
                    //验证是否收藏自己发布的物品
                    if (item.user._id === userId)
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
    var getItems = function(itemIds, next) {
        Item.find({_id:{$in:itemIds}}, Model.ItemFieldsForCli)
            .populate('user', Model.UserFieldsForCli)
            .exec(function(err, items) {
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
            return res.status(200).jsonp({
                data:{
                    nextId:results.slice(-1)[0]._id, 
                    pageCount:req.query.pageCount, 
                    itemList:results
                }});            
        }
    })
});

module.exports = router;