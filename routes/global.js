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
                    _.each(originalObj, function (n) {
                        originalObj.user = userObject;
                    });
                    next(null, originalObj);
                } else {
                    var uniqUserId = {};
                    _.each(originalObj, function (obj) {
                        uniqUserId[obj.userId] = ObjectId(obj.userId);
                    });
                    db.mongo.collection('users').find({
                        _id : {$in : _.values(uniqUserId)}
                    }, userObjectFields).toArray(function(err, results) {
                        if (err) {
                            logger.error(error.message.server.mongoQueryError);
                            next(error.object.databaseError);
                        } else if (results) {
                            var uniqUserIdObjects = {};
                            _.each(results, function(result) {
                                uniqUserIdObjects[result._id.toString()] = result;
                            });
                            _.each(originalObj, function (obj) {
                                obj.user = uniqUserIdObjects[obj.userId];
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
    
    //获取用于返回给客户端的User对象
    getUserInfoById : function(userId) {
        var callback = function(next) {
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
        if (userId) {
            return function(next) {
                db.mongo.collection('users').find({ _id: ObjectId(userId) }, userObjectFields)
                .limit(1).toArray(callback(next));
            }
        } else {
            return function (userId, next) {
                db.mongo.collection('users').find({ _id: ObjectId(userId) }, userObjectFields)
                .limit(1).toArray(callback(next));
            };
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
