var express = require('express');
var router = express.Router();
var async = require('async');
var _ = require('lodash');
var global = require('./global');
var error = require('./error');
//var db = require('./db');
var logger = require('log4js').getLogger("comment");
var ObjectId = require('mongodb').ObjectId;
var Model = require('../models/mongoModels');
var Comment = require('../models/mongoModels').Comment;
var User = require('../models/mongoModels').User;
var Item = require('../models/mongoModels').Item;

//为物品添加评论
router.post('/addItemComment', global.checkSession, global.decryptOnRequest, function (req, res) {
	//给商品添加评论
    var addComment = function (next) {
		var data = {
            content : req.body.content,
            user : req.loginUser._id,
            item : req.body.itemId
        };
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
    
    var appendItemObject = function(comment, next) {
        Item.Item.populate(comment, { path: 'item' }, function (err, comment) {
            if (err) {
                
            } else {
                next(null, comment);
            }
        });
    };
    //给该商品的发布者发送消息
    var addNoti = function (commentObj, next) {
        var data = {
            user: commentObj.user._id,
            comment: commentObj._id,
            type: 1,       //TODO:消息类型
            content: ''    //TODO:消息内容
        };
        User.findById(commentObj.item.user, function (err, user) {
            if (err) {
                logger.error(error.message.server.mongoQueryError + err);
                next(error.object.databaseError);
            } else if (user) {
                user.notifications.push(data);
                user.save(function (err) {
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
            return res.status(201).jsonp({ data: { itemComment: result } });
        }	
	}
	async.waterfall([addComment, appendItemObject, addNoti], callback);
});

//获取物品的评论/回复列表
router.get('/getItemCommentList', global.checkSession, global.decryptOnRequest, function (req, res) {
    if (req.query.itemId) {
        var query = Comment.find({ itemId: req.query.itemId })
            .sort({ addTime: 1 })
            .limit(parseInt(req.query.numPerPage))
            .populate('item', Model.ItemFieldsForCli)
            .populate('user', Model.UserFieldsForCli);
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