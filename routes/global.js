var db = require('./db');
var error = require('./error');
var async = require('async');
var assert = require('assert');
var _ = require('lodash');
var logger = require('log4js').getLogger("global");
var ObjectId = require('mongodb').ObjectId;

//客户端所需的User对象字段
var userObjectFields = { _id: 1, userName: 1, email: 1, avator: 1, regionCode: 1, introduce: 1 };
module.exports.userObjectFields = userObjectFields;
var itemObjectFields = { _id:1, name:1, type:1, disable:1, categoryId:1, 
	secondCategoryId:1, conditionId:1, regionCode:1, descriptionContent:1,
	price:1, addTime:1, updateTime:1, images:1, userId:1};
module.exports.itemObjectFields = itemObjectFields;

module.exports = {
    
    //检测是否带有需要的token
    checkSession: function (req, res, next) {
        if ((req.body.loginId || req.query.loginId) && req.loginUser) {
            next();
        } else {
            return res.status(403).jsonp({ errorMessage: error.message.client.tokenRequired });
        }
    },
    
    //对请求数据进行解密
    decryptOnRequest: function (req, res, next) {
        next();
    },
    
    //对相应数据进行加密
    encryptOnResponse: function (req, res) {

    },
    
    //根据userId字段添加给客户端的User对象
    appendUserObject : function (userObject) {
        return function (originalObj, next) {
            if (originalObj && !(originalObj instanceof Array))
                originalObj = [originalObj];
            if (originalObj) {
                if (userObject) {
                    _.each(originalObj, function (obj) {
                        obj.user = userObject;
                    });
                    next(null, originalObj);
                } else {
                    var uniqUserId = _.chain(originalObj)
                        .map(originalObj, function (obj) {
                            return ObjectId(obj.userId);
                        }).uniq(true);
                    db.mongo.collection('users').find({
                        _id : {$in : uniqUserId}
                    }, userObjectFields).toArray(function(err, results) {
                        if (err) {
                            logger.error(error.message.server.mongoQueryError);
                            next(error.object.databaseError);
                        } else if (results) {
                            _.each(originalObj, function (obj) {
                                obj.user = _.find(results, {_id : obj.userId});
                                delete obj.userId;
                            });
                            next(null, originalObj);
                        }
                    });
                }
            } else {
                next(null, null);
            }
        };
    },
    
    //根据itemId字段添加给客户端的Item对象
    appendItemObject : function (objsWithId, next) {
        //统一为Array进行操作
        if (objsWithId && !(objsWithId instanceof Array)) {
            objsWithId = [objsWithId];
        }
        //获取去重后的itemId
        var uniqItemIds = _.chain(objsWithId)
            .map(function (obj) {
                return ObjectId(obj.itemId);
            }).uniq(true);

        db.mongo.collection('items').find({
            _id: { $in: uniqItemIds }
        }, itemObjectFields, function (err, result) {
            if (err) {
                logger.error(error.message.server.mongoQueryError + err);
                next(error.object.databaseError);
            } else if (result) {
                _.each(objsWithId, function (obj) {
                    obj.item = _.find(result, { _id: obj.itemId });
                    delete obj.itemId;
                });
                next(null, result);
            }
        });
    },
    
    //获取用于返回给客户端的User对象
    getUserInfoById: function (userId) {
        var callback = function (next) {
            return function (err, docs) {
                if (err) {
                    logger.error(error.message.server.mongoQueryError + err);
                    next(error.object.databaseError, null);
                } else if (docs) {
                    //logger.debug(docs[0]);
                    next(null, docs[0]);
                }
            };
        };
        return function (next) {
            db.mongo.collection('users').find({ _id: ObjectId(userId) }, userObjectFields)
                .limit(1).toArray(callback(next));
        }
    },
    
    //MongoDB CURD操作回调
    callbacks: {
        mongoQuery: function (next) {
            return function (err, docs) {
                //logger.debug(docs);
                if (err) {
                    logger.error(error.message.internal.mongoQueryError + err);
                    next(error.object.databaseError);
                } else if (docs) {
                    //logger.debug(docs);
                    next(null, docs);
                }
            };
        },
        mongoInsert: function (next) {
            return function (err, result) {
                if (err) {
                    logger.error(error.message.internal.mongoInsertError + err);
                    next(error.object.databaseError);
                } else {
                    //logger.debug(result);
                    next(null, result.ops);
                }
            }
        },
        mongoUpdate: function (next) {
            return function (err, results) {
                if (err || results.ok !== 1) {
                    logger.error(error.message.internal.mongoUpdateError + err);
                    next(error.object.databaseError);
                } else if (results.ok === 1) {
                    //logger.debug(results);
                    next(null, results.value ? results.value : results);
                }
            }
        },
    }
};

module.exports.itemType = { forSell: 0, forBuy: 1 };
