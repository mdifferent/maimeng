var express = require('express');
var router = express.Router();
var async = require('async');
var global = require('./global');
var error = require('./error');
var db = require('./db');
var logger = require('log4js').getLogger("comment");
var ObjectId = require('mongodb').ObjectId;

/*根据对象的itemId属性添加相应的Item对象
  objsWithId : 具有itemId属性的对象或对象数组
*/
var appendItemObject = function (objsWithId, next) {
	var uniqueItemMap = {};
	//统一为Array进行操作
	if (objsWithId && !(objsWithId instanceof Array)) {
		objsWithId = [objsWithId];
	}
	//ItemId去重
	for (var i = 0; i < objsWithId.length; ++i) {
		uniqueItemMap[objsWithId[0].itemId] = 1;
	}
	//根据去重后的ItemId集合获取相应的Item对象
	var getItems = function(next) {
		async.each(Object.keys(uniqueItemMap), function(id, callback) {
			db.mongo.collection('items').find({
				_id: ObjectId(id)
			}, global.itemObjectFields, function(err, result) {
				if (err) {
					logger.error(error.message.server.mongoQueryError + err);
				} else if (result) {
					uniqueItemMap[id] = result;
				}
				callback();
			}).limit(1);
		}, function(err, result) {
			next(null, uniqueItemMap);
		});
	};
	//给每一个传入的对象添加相应的item对象
	var appendItem = function(map, next) {
		async.each(objsWithId, function (obj, callback) {
			obj.item = map[obj.itemId];
			delete obj.itemId;
			callback();
		}, function (err) {
			next(null, objsWithId);
		});
	}
	async.waterfall([getItems, appendItem], function(err, result) {
		next(null, result);
	})
};

//为物品添加评论
router.post('/addItemComment', function (req, res) {
	var addComment = function (userId, next) {
		var data = req.body;
		delete data.loginId;
		data.addTime = new Date().getTime();
		data.userId = userId;
		//logger.debug(data);
		db.mongo.collection('comments').insertOne(data, global.callbacks.mongoInsert(next));
	};
	var addNoti = function(commentObj, next) {
		db.mongo.collection('users').findOneAndUpdate({_id:ObjectId()})
	};
	var callback = function (err, result) {
		if (err)
			return res.status(err.status).json({ errorMessage: err.errorMessage });
		else if (result)
			return res.status(201).jsonp({ data: { itemComment: result[0] } });
	}
	global.checkTokenWrapper(req, res,
		[addComment, global.appendUserObject, appendItemObject, addNoti], callback);
});

//获取物品的评论/回复列表
router.get('/getItemCommentList', function (req, res) {
	var getCommentList = function(next) {
		if (req.query.itemId) {
			db.mongo.collection('comments').find({
				itemId: ObjectId(req.query.itemId),
				_id: { $gt: ObjectId(req.query.nextId) }
			}).sort({
				addTime: 1
			}).limit(parseInt(req.query.numPerPage)).toArray(function (err, docs) {
				if (err) {
					logger.error(error.message.server.mongoQueryError + err);
					next(error.object.databaseError);
				} else if (docs) {
					next(null, docs);
				}
			});
		} else {
			next(error.object.fieldRequired);
		}
	};
	var callback = function(err, result) {
		if (err)
			return res.status(err.status).json({ errorMessage: err.errorMessage });
		else if (result)
			return res.status(201).jsonp({ data: { 
				itemCommentList: result, 
				pageCount:req.query.pageCount,
				nextId: result.slice(-1)._id.toString()  
			} });
	};
	async.waterfall([getCommentList, global.appendUserObject, appendItemObject], callback);
});


module.exports = router;