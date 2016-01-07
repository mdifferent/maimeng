var db = require('./db');
var error = require('./error');
var async = require('async');
var assert = require('assert');
var logger = require('log4js').getLogger("global");
var ObjectId = require('mongodb').ObjectId;

//客户端所需的User对象字段
var userObjectFields = { _id: 1, userName: 1, email: 1, avator: 1, regionCode: 1, introduce: 1 };
module.exports.userObjectFields = userObjectFields;
var itemObjectFields = { _id:1, name:1, type:1, disable:1, categoryId:1, 
	secondCategoryId:1, conditionId:1, regionCode:1, descriptionContent:1,
	price:1, addTime:1, updateTime:1, images:1, userId:1};
module.exports.itemObjectFields = itemObjectFields;

//检测是否有用户登录会话信息
var getUserIdByToken = function (token, next) {
	var callback = function (err, result) {
		if (err) {
			logger.error(error.message.server.redisReadError + err);
			next(error.object.databaseError, null);
		} else if (result) {
			//logger.debug(result);
			next(null, result);
		} else {
			next({ status: 401, errorMessage: error.message.sessionTimeout });
		}
	};
	db.redis.get(token, callback);
};
module.exports.getUserIdByToken = getUserIdByToken;

/*获取用于返回给客户端的User对象
* userId : String
*/
var getUserInfoById = function(userId) {
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
}

module.exports.getUserInfoById = getUserInfoById;

/*根据userId字段添加给客户端的User对象
* originalObj : Array / Object
* next : Function
*/
var appendUserObject = function(originalObj, next) {
	if (originalObj && !(originalObj instanceof Array))
		originalObj = [originalObj];
	var operation = function(obj, callback) {
		if (obj.userId) {
			db.mongo.collection('users').find({ _id: ObjectId(obj.userId) }, userObjectFields)
			.limit(1).toArray(function (err, docs) {
				if (err) {
					logger.error(error.message.server.mongoQueryError + err);
				} else if (docs) {
					//logger.debug(docs);
					obj.user = docs[0];
					delete obj.userId;
				}
				callback();
			});
		} else {
			logger.error('Item ' + obj._id + ' has no user');
		}
	};
	var callback = function(err) {
		next(null, originalObj);
	}
	if (originalObj)
		async.each(originalObj, operation, callback);
	else
		next(null, null);
};
module.exports.appendUserObject = appendUserObject;

//Wrapper function for interface need to check user login status
module.exports.checkTokenWrapper = function (req, res, operation, callback) {
	var checkOp = function (next) {
		if (req.body.loginId)
			getUserIdByToken(req.body.loginId, next);
		else if (req.query.loginId) {
			getUserIdByToken(req.query.loginId, next);
		}
		else
			return res.status(400).jsonp({errorMessage:error.object.fieldRequired});
	};
	var waterfallFuncs = [checkOp];

	if (operation instanceof Array)
		waterfallFuncs = waterfallFuncs.concat(operation);
	else
		waterfallFuncs.push(operation);

	if (req.body.loginId || req.query.loginId) {
		async.waterfall(waterfallFuncs, callback);
	} else {
		return res.status(400).json({ errorMessage: error.message.tokenRequired });
	}
}

module.exports.callbacks = {
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
};

module.exports.itemType = { forSell: 0, forBuy: 1 };
