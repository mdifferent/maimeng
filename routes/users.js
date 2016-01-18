var async = require('async');
var crypto = require('crypto');
var express = require('express');
var jwt = require('jsonwebtoken');

var router = express.Router();
var db = require('./db');
var logger = require('log4js').getLogger("user");
var error = require('./error');
var global = require('./global');
var ObjectId = require('mongodb').ObjectId;
var Model = require('../models/mongoModels');
var User = require('../models/mongoModels').User;

//用户登录
router.post('/login', function (req, res) {
  if (req.body.input && req.body.password) {
    var queryFilter = { $or: [{ userName: req.body.input }, 
                              { email: req.body.input }], 
                        password: req.body.password };                  
    //读取用户数据
    var checkAccount = function (next) {
      User.findOne(queryFilter).select(Model.UserFieldsForCli).exec(function(err, user) {
          if (err) {
            logger.error(exports.message.server.mongoQueryError + err);
            next(error.object.databaseError);
          } else if (user) {
            next(null, user);
          } else {
            next(error.object.userNotFound);
          }
      });
    };
    //生成token
    var generateToken = function (user, next) {
      var md5 = crypto.createHash('md5');
      //RandomKey生成格式：MD5(用户名+登录时间+IP)
      logger.debug(Date.now().toString());
      md5.update(user.userName + Date.now().toString() + req.ip);
      var randomKey = md5.digest('hex');
      jwt.sign(user, randomKey, function(token) {
          next(null, user, token, randomKey);
      });
    };
    //记录登录状态
    var recordLoginStatus = function(user, token, key, next) {
      db.redis.hmset(token, 'key', key, 'user', user, function (err, res) {
        if (err)
          next(error.object.databaseError);
        else
          next(null, { user: user, loginId: token });
      });
    };
    var callback = function (err, result) {
      logger.debug(result);
      if (err)
        return res.status(err.status).jsonp({ errorMessage: err.errorMessage });
      else
        return res.status(201).jsonp({ data: result });
    };
    async.waterfall([checkAccount, generateToken, recordLoginStatus], callback);
  } else {
    return res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired });
  }
});

//用户登出
router.post('/logout', function (req, res) {
    if (req.body.loginId && req.loginUser) {
        db.redis.del(req.body.loginId, function (err, result) {
            if (err) {
                logger.error(error.message.server.redisWriteError + err);
                return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
            } else if (result === 1) {
                return res.status(201).jsonp({ data: req.loginUser });
            }
        });
    } else {
        return res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired });
    }
});

//用户注册
router.post('/register', function (req, res) {
  if (req.body.userName && req.body.password && req.body.email) {
    //检测用户名是否已存在
    var checkUserExist = function (next) {
        var checkField = { $or: [{ uesrName: req.body.userName }, { email: req.body.email }] };
        User.findOne(checkField, function(err, user) {
            if (err) {
                logger.error(exports.message.server.mongoQueryError + err);
                next(error.object.databaseError);
            } else if (user) {
                next(error.object.userNameDuplicate);
            } else {
                next();
            }
        });
    };
    //创建新用户
    var createAccount = function (next) {
        User.create(req.body, function (err, user) {
            if (err) {
                logger.error(exports.message.server.mongoInsertError + err);
                next(error.object.databaseError, null);
            } else if (user) {
                //logger.debug(result);
                next(null, user);
            } else {
                next(error.object.databaseError, null);
            }
        });
    };
    var callback = function (err, result) {
      if (err) {
        return res.status(err.status).jsonp({ errorMessage: result.errorMessage });
      } else if (result) {
        delete result[1].password;
        return res.status(201).jsonp({data:result[1]});
      }
    };
    async.series([checkUserExist, createAccount], callback);
  } else {
    return res.status(400).jsonp({ errorMessage: error.message.fieldRequired });
  }
});


var updateCommonCallback = function (res) {
  return function (err, result) {
    if (err) {
      return res.status(err.status).jsonp({ errorMessage: result.errorMessage });
    } else if (result) {
      return res.status(201).jsonp({data:result[0]});
    }
  }
}

//用户更改密码
router.post('/modifyPassword', global.checkSession, function (req, res) {
    if (req.body.oldPassword && req.body.password) {
        var oldPasswordHash = req.body.oldPassword;
        var newPasswordHash = req.body.password;  //TODO : server side crypto
        User.findOneAndUpdate(
            { _id: ObjectId(req.loginUser._id), password: oldPasswordHash },
            { password: newPasswordHash,  },
            { new: true, select: 'userName email phone regionCode introduce avator createdAt' },
            function (err, user) {
                if (err) {
                    logger.error(error.message.internal.mongoUpdateError + err);
                    return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
                } else if (user) {
                    return res.status(201).jsonp({ data: { user: user } });
                }
            });
    } else {
        return res.status(400).jsonp({ errorMessage: error.message.fieldRequired });
    }
});

//用户更改简介
router.post('/modifyIntroduce', global.checkSession, function (req, res) {
    if (req.body.introduce) {
        User.findOneAndUpdate(
            { _id: ObjectId(req.loginUser._id) },
            { introduce : req.body.introduce, lastModified: Date.now },
            { new: true, select: 'userName email phone regionCode introduce avator createdAt' },
            function (err, user) {
                if (err) {
                    logger.error(error.message.internal.mongoUpdateError + err);
                    return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
                } else if (user) {
                    return res.status(201).jsonp({ data: { user : user } });
                }
            });
    } else {
        return res.status(400).jsonp({ errorMessage: error.message.fieldRequired });
    }
});

//用户更改头像
router.post('/modifyAvator', global.checkSession, function (req, res) {

});

//用户详细信息
router.get('/getUserDetail', function (req, res) {
    User.findById(req.query.userId, 
        'userName email phone regionCode introduce avator createdAt', 
        function(err, user) {
            if (err) {
                logger.error(exports.message.server.mongoQueryError + err);
                return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
            } else if (user) {
                return res.status(200).jsonp({ data: { user: user} });
            } else {
                return res.status(404).jsonp({ errorMessage: error.message.client.userNotFound });
            }
        });
});

module.exports = router;
