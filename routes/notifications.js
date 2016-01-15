var express = require('express');
var router = express.Router();
var async = require('async');
var _ = require('lodash');
var logger = require('log4js').getLogger("notification");
var global = require('./global');
var error = require('./error');
var db = require('./db');

var Model = require('../models/mongoModels');
var User = require('../models/mongoModels').User;


//获取我的消息列表
router.get('/getMyNotificationList', function (req, res) {
    User.findById(req.loginUser._id).select('notifications').exec(function(err, user) {
        if (err) {
            logger.error(error.message.server.mongoQueryError + err);
            return res.status(500).json(error.message.client.databaseError);
        } else if (user) {
            var startIdx = _.findIndex(user.notifications, function(notification) {
                return notification._id.toString() === req.query.nextId;
            }) + 1;
            var notis = _.slice(user.notifications, startIdx, startIdx + parseInt(req.query.numPerPage));
            User.populate(notis, {path:'userId'}, function(err, notis) {
                if (err) {
                    logger.error(error.message.server.mongoQueryError + err);
                } 
                if (notis) {                    
                    Comment.populate(notis, {path:'commentId'}, function(err, notis) {
                        if (err) {
                            logger.error(error.message.server.mongoQueryError + err);
                        } 
                        if (notis) {                           
                            return res.status(200).jsonp({data:{
                                nextId:notis.slice(-1)[0]._id, 
                                pageCount:req.query.pageCount, 
                                notificationList:notis}});
                        }
                    });
                }
            });
        }
    });
});

router.post('/sendNotification', function (req, res) {

});

module.exports = router;