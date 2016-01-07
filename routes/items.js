var async = require('async');
var express = require('express');
var router = express.Router();

var logger = require('log4js').getLogger("item");
var global =  require('./global');
var error = require('./error');
var db = require('./db');
var ObjectId = require('mongodb').ObjectId;

/************************************************
 * 发布物品
 ***********************************************/
function addItemCommon(req, res, itemType) {
	return function(userId, next) {
		if (req.body.name && req.body.price) {
			var data = req.body;
			delete data.loginId;
			data.userId = userId;
			data.type = itemType;
			data.disable = false;
			data.addTime = new Date().getTime();
			data.updateTime = data.addTime;
			db.mongo.collection('items').insertOne(data, global.callbacks.mongoInsert(next));
		} else {
			next(error.object.fieldRequired);
		}
	} 
}

function addItemCallbackCommon(res) {
	return function(err, result) {
		if (err)
			return res.status(err.status).jsonp({errorMessage:err.errorMessage});
		else if (result) {
			return res.status(201).jsonp({data:result[0]});
		}
	};
}

//发布物品
router.post('/addItem', function(req, res) {
	global.checkTokenWrapper(req, res, 
		[addItemCommon(req, res, global.itemType.forSell), 
		 global.appendUserObject],
		addItemCallbackCommon(res));
});

//发布求物
router.post('/addItemRequest', function(req, res) {
	global.checkTokenWrapper(req, res, 
		[addItemCommon(req, res, global.itemType.forBuy), 
		 global.appendUserObject],
		addItemCallbackCommon(res));
});


/************************************************
 * 修改物品
 ***********************************************/
//修改物品信息
router.post('/modifyItem', function(req, res) {
	var updateItemInfo = function(userId, next) {
		db.mongo.collection('items').findOneAndUpdate({ _id : ObjectId(req.body.itemId) }, 
			{ $set: { name : req.body.name, 
					categoryId : req.body.categoryId, 
					secondCategoryId : req.body.secondCategoryId,
					conditionId : req.body.conditionId,
					regionCode : req.body.regionCode,
					descriptionContent : req.body.descriptionContent,
					price : req.body.price,
					images : req.body.images },
			  $currentDate: { "updateTime": true }},
			{ projection:global.itemObjectFields,
			  returnOriginal:false }, 
			global.callbacks.mongoUpdate(next));
	};
	var callback = function(err, result) {
		if (err)
			return res.status(err.status).jsonp({errorMessage:err.errorMessage});
		else if (result) {
			//TODO 分类名称，状况名称
			//logger.debug(result);
			return res.status(201).jsonp({data:result[0]});
		}
	};
	global.checkTokenWrapper(req, res, [updateItemInfo,global.appendUserObject], callback);
});

//使物品失效
router.post('/disableItem', function(req, res) {
	var operation = function(userId, next) {
		db.mongo.collection('items').findOneAndUpdate({ _id : ObjectId(req.body.itemId) }, 
			{ $set : { disable : true },
			  $currentDate: { "updateTime": true }},
			{ projection:global.itemObjectFields,
			  returnOriginal:false }, 
			global.callbacks.mongoUpdate(next)); 
	};
	var callback = function(err, result) {
		if (err)
			return res.status(err.status).jsonp({errorMessage:err.errorMessage});
		else if (result)
			return res.status(201).jsonp({data:result[0]});
	};
	global.checkTokenWrapper(req, res, [operation, global.appendUserObject], callback);
});

/************************************************
 * 获取物品信息
 ***********************************************/
var getItemInfoById = function(itemId) {
	return function(next) {
		//logger.debug(ObjectId(itemId));
		db.mongo.collection('items').find({ _id : ObjectId(itemId) })
			.limit(1).toArray(global.callbacks.mongoQuery(next));
	};
};
//获取物品信息
router.get('/getItemDetail', function(req, res) {
	var callback = function(err, result) {
		if (err)
			return res.status(err.status).jsonp({errorMessage:err.errorMessage});
		else if (result) {
			//logger.debug(result);
			return res.status(201).jsonp({data:result[0]});
		}
	};
	if (req.query.itemId) {
		async.waterfall([getItemInfoById(req.query.itemId), global.appendUserObject], callback);
	} else {
		return res.status(400).jsonp({errorMessage:'缺少itemId'});
	}
});

/************************************************
 * 物品列表
 ***********************************************/
function listCommonOperation(req, res, itemType) {
	var operation = function(user, next) {
		var queryFilter = { userId:user._id.toString(), type:parseInt(itemType) };
		if (req.query.nextId)
			queryFilter._id = {$gt:ObjectId(req.query.nextId)};
		db.mongo.collection('items').find(queryFilter)
			.sort({ _id:1 }).limit(parseInt(req.query.numPerPage))
			.toArray(function(err, docs) {
				if (err) {
					logger.error(error.message.server.mongoQueryError + err);
					next(error.object.databaseError);
				} else if (docs) {
					//logger.debug(docs);
					docs.forEach(function(doc) {
						doc.user = user;
						delete doc.userId;
						doc.descriptionSummary = doc.descriptionContent.substr(0,30);
						delete doc.descriptionContent;
					});
					next(null, docs);
				}
		});
	};
	var callback = listCommonCallback(req, res);
	if (req.query.userId) 
		async.waterfall([global.getUserInfoById(req.query.userId), operation], callback);
	else if (req.query.loginId)
		global.checkTokenWrapper(req, res, [global.getUserInfoById(), operation], callback);
	else
		res.status(400).jsonp({errorMessage:error.object.fieldRequired});
}
function listCommonCallback(req, res) {
	return function(err, result) {
		if (err)
			return res.status(err.status).jsonp({errorMessage:err.errorMessage});
		else if (result) {
			return res.status(200)
				.jsonp({nextId:result.slice(-1)[0]._id, pageCount:req.query.pageCount, data: result});
		} else {
			return res.status(200).jsonp({pageCount:req.query.pageCount, data:[]});
		}
	};
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
	return function(err, result) {
		if (err)
			return res.status(err.status).jsonp({errorMessage:err.errorMessage});
		else if (result)
			return res.status(201).jsonp({data:result[0]});
		else 
			return res.status(500).jsonp({errorMessage:error.message.noUpdate});
	};
};
//更改用户的收藏夹
function toggleFavorite(toAdd) {
	return function(item, userId, next) {
		var itemId = item._id.toString();
		var operation = toAdd ? {$addToSet:{favorite:itemId}} : {$pull:{favorite:itemId}};
		db.mongo.collection('users').updateOne({ _id:ObjectId(userId) },
			operation, function(err, results) {
				if (err) {
					logger.error(error.message.server.mongoUpdateError + err);
					next(error.object.databaseError);
				} else if (results.result.ok === 1) {
					next(null, item);
				}
			});
	};
};
//获取Item对象
function getItem(itemId) {
	return function(userId, next) {
		db.mongo.collection('items').find({_id:ObjectId(itemId)}, global.itemObjectFields)
			.limit(1).toArray(function(err, doc) {
			if (err) {
				logger.error(error.message.internal.mongoQueryError + err);
				next(error.object.databaseError);
			} else if (doc[0]) {
				//验证是否收藏自己发布的物品
				if (doc[0].userId === userId)
					next(error.object.favorateSelf);
				else
					next(null, doc[0], userId);
			} else {
				logger.error(error.message.server.mongoQueryError);
				next(error.object.databaseError);
			}
		});
	}
}
//收藏物品
router.post('/addItemToFavorite', function(req, res) {
	if (req.body.itemId)
		global.checkTokenWrapper(req, res, 
			[getItem(req.body.itemId), toggleFavorite(true), global.appendUserObject], 
			favorateCommonCallback(res));
	else
		res.status(400).jsonp({errorMessage:error.message.client.fieldRequired});
});

//取消收藏
router.post('/removeItemFromFavorite', function(req, res) {
	if (req.body.itemId)
		global.checkTokenWrapper(req, res, 
			[getItem(req.body.itemId), toggleFavorite(false), global.appendUserObject], 
			favorateCommonCallback(res));
	else
		res.status(400).jsonp({errorMessage:error.message.client.fieldRequired});			
});

//获取我收藏的物品列表
router.get('/getMyFavoriteItemList', function(req, res) {
	var getItemIds = function(userId, next) {
		db.mongo.collection('users').findOne({_id:ObjectId(userId)},{favorite:1},
			function(err, result) {
				if (err) {
					logger.error(error.message.server.mongoQueryError + err);
					next(error.object.databaseError);
				} else if (result.favorite && result.favorite.length > 0) {
					var beginIndex = 0;
					for (var i = 0; i < result.favorite.length; ++i) {
						if (result.favorite[i] === req.query.nextId) {
							beginIndex = i + 1;
							break;
						}
					}
					var itemIds = result.favorite.slice(beginIndex, beginIndex + parseInt(req.query.numPerPage));
					logger.debug(itemIds);
					next(null, itemIds);
				} else {
					next(null, null);
				}
		});
	};
	var getItems = function(itemIds, next) {
		if (itemIds) {
			var itemIdObjects = [];
			itemIds.forEach(function(id) {itemIdObjects.push(ObjectId(id));});
			logger.debug(itemIdObjects);
			db.mongo.collection('items').find({_id : {$in : itemIdObjects}}).toArray(
				function(err, result) {
					if (err) {
						logger.error(error.message.server.mongoQueryError + err);
						next(error.object.databaseError);
					} else if (result) {
						next(null, result);
					}
				});
		} else {
			next(null, null);
		}
	};
	global.checkTokenWrapper(req, res, [getItemIds, getItems, global.appendUserObject], listCommonCallback(req, res));
});

module.exports = router;