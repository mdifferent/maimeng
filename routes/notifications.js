var express = require('express');
var router = express.Router();
var async = require('async');
var _ = require('lodash');
var logger = require('log4js').getLogger("notification");
var global = require('./global');
var error = require('./error');
var db = require('./db');

//获取我的消息列表
router.get('/getMyNotificationList', function (req, res) {
    var getMyNotifications = function (next) {
        db.mongo.collection('users').find({ _id: req.loginUser._id },
            { notifications: 1 }).limit(1).next(function (err, doc) {
                if (err) {
                    logger.error(error.message.server.mongoQueryError + err);
                    return res.status(500).json(error.message.client.databaseError);
                } else if (doc) {
                    var beginIndex = 0;
                    for (var i = 0; i < doc.notifications.length; ++i) {
                        if (doc.notifications[i]._id === req.query.nextId) {
                            beginIndex = i + 1;
                            break;
                        }
                    }
                    next(null, doc.notifications.slice(beginIndex, beginIndex + req.query.numPerPage));
                }
            });
    };
    var callback = function (err, result) {
        if (err)
            return res.status(err.status).json({
                errorMessage: err.errorMessage
            });
        else if (result) {
            return res.status(200).json({
                nextId: result.slice(-1).id,
                pageCount: req.query.pageCount,
                notificationList: result
            });
        }
    };
    async.waterfall([getMyNotifications, global.appendUserObject], callback);
});

router.post('/sendNotification', function (req, res) {

});

module.exports = router;