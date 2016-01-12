var express = require('express');
var router = express.Router();
var async = require('async');
var _ = require('lodash');
var global = require('./global');
var error = require('./error');
var db = require('./db');
var logger = require('log4js').getLogger("comment");
var ObjectId = require('mongodb').ObjectId;

//为物品添加评论
router.post('/addItemComment', global.checkSession, global.decryptOnRequest, function (req, res) {
	//给商品添加评论
    var addComment = function (next) {
		var data = req.body;
		delete data.loginId;
		data.addTime = new Date().getTime();
		data.userId = req.loginUser._id;
		//logger.debug(data);
		db.mongo.collection('comments').insertOne(data, global.callbacks.mongoInsert(next));
	};
    //给该商品的发布者发送消息
	var addNoti = function(commentObj, next) {
        var data = {
            userId : commentObj.item.userId,
            itemCommentId : commentObj._id,
            addTime : commentObj.addTime,
            type : 1,       //TODO:消息类型
            content : ''    //TODO:消息内容
        };
		db.mongo.collection('users').findOneAndUpdate({_id:ObjectId(commentObj.item.userId)}, 
            {$addToSet:{notifications:data}},
            function(err, result) {
                if (err) {
                    logger.error(error.message.server.mongoUpdateError + err);
                    next(error.object.databaseError);
                } else {
                    next(null, commentObj);
                }
            });
	};
	var callback = function (err, result) {
		if (err)
			return res.status(err.status).json({ errorMessage: err.errorMessage });
		else if (result) {
            result[0].user = req.loginUser;
            return res.status(201).jsonp({ data: { itemComment: result[0] } });
        }	
	}
	async.waterfall([addComment, global.appendItemObject, addNoti], callback);
});

//获取物品的评论/回复列表
router.get('/getItemCommentList', global.checkSession, global.decryptOnRequest, function (req, res) {
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
	async.waterfall([getCommentList, global.appendUserObject, global.appendItemObject], callback);
});


module.exports = router;