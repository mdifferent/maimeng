var express = require('express');
var router = express.Router();
var async = require('async');
var _ = require('lodash');
var global = require('./global');
var error = require('./error');
var db = require('./db');
var logger = require('log4js').getLogger("comment");
var ObjectId = require('mongodb').ObjectId;
var Model = require('../models/mongoModels');
var Comment = require('../models/mongoModels').Comment;
var User = require('../models/mongoModels').User;

//为物品添加评论
router.post('/addItemComment', global.checkSession, global.decryptOnRequest, function (req, res) {
	//给商品添加评论
    var addComment = function (next) {
		var data = req.body;
		delete data.loginId;
		data.userId = req.loginUser._id;
        data.itemId = req.itemId;
		//logger.debug(data);
        Comment.save(data, function(err, comment, numAffected) {
            if (err) {
                logger.error(error.message.server.mongoInsertError + err);
                next(error.object.databaseError);
            } else if (numAffected > 0 && comment) {
                comment.user = req.loginUser;
                next(null, comment);
            }
        });
	};
    //给该商品的发布者发送消息
	var addNoti = function(commentObj, next) {
        var data = {
            userId : commentObj.userId,
            itemCommentId : commentObj._id,
            type : 1,       //TODO:消息类型
            content : ''    //TODO:消息内容
        };
        User.findById(commentObj.item.userId, function(err, user) {
            if (err) {
                logger.error(error.message.server.mongoQueryError + err);
                next(error.object.databaseError);
            } else if (user) {
                user.notifications.push(data);
                user.save(function(err) {
                    if (err) {
                        logger.error(error.message.server.mongoInsertError + err);
                        next(error.object.databaseError);
                    } else {
                        next(null, commentObj);
                    }
                });
            } else {
                next(error.object.userNotFound);
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
    if (req.query.itemId) {
        var query = Comment.find({ itemId: req.query.itemId })
            .sort({ addTime: 1 })
            .limit(parseInt(req.query.numPerPage))
            .populate('itemId', Model.ItemFieldsForCli)
            .populate('userId', Model.UserFieldsForCli);
        if (req.query.nextId)
            query.where('_id').gt(req.query.nextId);
        query.exec(function(err, comments) {
            if (err) {
                logger.error(error.message.server.mongoQueryError + err);
                return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
            } else if (comments) {
                return res.status(200).jsonp({ data: { 
                    itemCommentList: comments, 
                    pageCount:req.query.pageCount,
                    nextId: comments.slice(-1)._id.toString()  
                } });
            }
        });
    } else {
        return res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired });
    }
});


module.exports = router;