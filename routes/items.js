var async = require('async');
var _ = require('lodash');
var express = require('express');
var router = express.Router();

var logger = require('log4js').getLogger("item");
var global =  require('./global');
var error = require('./error');
var db = require('./db');
var ObjectId = require('mongodb').ObjectId;
var Model = require('../models/mongoModels');
var Item = require('../models/mongoModels').Item;
var User = require('../models/mongoModels').User;

/************************************************
 * 发布物品
 ***********************************************/
function addItemCommon(req, res, itemType) {
    if (req.body.name && req.body.price) {
        var data = req.body;
        delete data.loginId;
        data.userId = req.loginUser._id;
        data.type = itemType;
        data.disable = false;
        Item.create(data, function (err, item) {
            if (err) {
                logger.error(error.message.server.mongoInsertError + err);
                return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
            } else if (item) {
                item.user = req.loginUser;
                delete item.userID;
                return res.status(201).jsonp({ data: { item: item } });
            }
        });
    } else {
        return res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired });
    }
}

//发布物品
router.post('/addItem', global.checkSession, global.decryptOnRequest, function(req, res) {
    addItemCommon(req,res,global.itemType.forSell);
});

//发布求物
router.post('/addItemRequest', function(req, res) {
    addItemCommon(req,res,global.itemType.forBuy);
});


/************************************************
 * 修改物品
 ***********************************************/
 var updateItemCallback = function(req, res) {
     return function (err, item) {
        if (err) {
            logger.error(error.message.server.mongoUpdateError + err);
            return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
        } else if (item) {
            item.user = req.loginUser;
            delete item.userID;
            return res.status(201).jsonp({ data: { item: item } });
        }
    }
 }
//修改物品信息
router.post('/modifyItem', global.checkSession, global.decryptOnRequest, function (req, res) {
    var updateData = req.body;
    delete updateData.loginId;
    delete updateData.itemId;
    updateData.updateTime = Date.now;
    Item.findByIdAndUpdate(req.body.itemId, updateData, { new: true }, 
        updateItemCallback(req, res));
});

//使物品失效
router.post('/disableItem', global.checkSession, global.decryptOnRequest, function (req, res) {
    Item.findByIdAndUpdate(req.body.itemId, { disabled: true }, { new: true }, 
        updateItemCallback(req, res));
});

/************************************************
 * 获取物品信息
 ***********************************************/
router.get('/getItemDetail', function(req, res) {
	if (req.query.itemId) {
		Item.findById(req.query.itemId)
            .select(Model.ItemFieldsForClie)
            .populate('userId', Model.UserFieldsForCli)
            .exec(function(err, item) {
                if (err) {
                    logger.error(error.message.server.mongoQueryError + err);
                    return res.status(500).jsonp({errorMessage:error.message.client.databaseError});
                } else if (item) {
                    return res.status(200).jsonp({data:{item : item}});
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
        query.where('userId').eq(req.query.userId);
    else if (req.loginUser)
        query.where('userId').eq(req.loginUser._id);
    else
        return res.status(400).jsonp({ errorMessage: error.object.fieldRequired });
    if (req.query.nextId)
        query.where('_id').gt(req.query.nextId);
    query.select(Model.ItemFieldsForCli);
    query.sort('_id', 1).limit(parseInt(req.query.numPerPage));
    query.populate('userId', Model.UserFieldsForCli);
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
        var operation = toAdd ? { $addToSet: { favorites: itemId } } : { $pull: { favorites: itemId } };
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
            .populate('userId', Model.UserFieldsForCli)
            .exec(function (err, item) {
                if (err) {
                    logger.error(error.message.internal.mongoQueryError + err);
                    next(error.object.databaseError);
                } else if (item) {
                    //验证是否收藏自己发布的物品
                    if (item.userId === userId)
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
    User.findById(req.loginUser._id, 'favorites').populate('favorites').exec(function(err, user) {
        if (err) {
            logger.error(error.message.server.mongoQueryError + err);
            return res.status(500).jsonp({errorMessage:error.message.client.databaseError});
        } else if (user) {
            var startIdx = _.findIndex(user.favorites, function(favorite) {
                return favorite._id.toString() === req.query.nextId;
            }) + 1;
            var items = _.slice(user.favorites, startIdx, startIdx + parseInt(req.query.numPerPage));
            return res.status(200).jsonp({data:{
                nextId:items.slice(-1)[0]._id, 
                pageCount:req.query.pageCount, 
                itemList:items}});
        }
    });
});

module.exports = router;