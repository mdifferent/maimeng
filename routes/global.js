var db = require('./db');
var error = require('./error');
var async = require('async');
var assert = require('assert');
var _ = require('lodash');
var logger = require('log4js').getLogger("global");

var Model = require('../models/mongoModels');
var Item = require('../models/mongoModels').Item;

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
