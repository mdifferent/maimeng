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
    var findUser = function (next) {
        User.findById(req.loginUser._id).select('notifications').exec(function (err, user) {
            if (err) {
                logger.error(error.message.server.mongoQueryError + err);
                return res.status(500).json(error.message.client.databaseError);
            } else if (user) {
                var startIdx = _.findIndex(user.notifications, function (notification) {
                    return notification._id.toString() === req.query.nextId;
                }) + 1;
                var notis = _.slice(user.notifications, startIdx, startIdx + parseInt(req.query.numPerPage));
                next(null, notis);
            }
        });
    };
    var appendUser = function(notis, next) {
        User.populate(notis, { path: 'user' }, function (err, notis) {
            if (err)
                logger.error(error.message.server.mongoQueryError + err);
            if (notis)
                next(null, notis);
        });
    };
    var appendComment = function(notis, next) {
        Comment.populate(notis, {path:'comment'}, function(err, notis) {
            if (err)
                logger.error(error.message.server.mongoQueryError + err);
            if (notis)   
                next(null, notis);
        });
    };
    async.waterfall([findUser, appendUser, appendComment], function(err, result) {
        if (err) {
            
        } else {
            return res.status(200).jsonp({data:{
                nextId:result.slice(-1)[0]._id, 
                pageCount:req.query.pageCount, 
                notificationList:result}});
        }
    });
});

router.post('/sendNotification', function (req, res) {

});

module.exports = router;