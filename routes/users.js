var async = require('async');
var crypto = require('crypto');
var express = require('express');
var jwt = require('jsonwebtoken');

var router = express.Router();
var db = require('./db');
var logger = require('log4js').getLogger("user");
var error = require('./error');
var global = require('./global');
var Model = require('../models/mongoModels');
var User = require('../models/mongoModels').User;
var security = require('../config/securityKeys');

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
            logger.error(error.message.server.mongoQueryError + err);
            next(error.object.databaseError);
          } else if (user) {
            logger.debug('User:' + user);
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
      md5.update(user.userName + Date.now().toString() + req.ip);
      var randomKey = md5.digest('hex');
      //logger.debug('Random key:' + randomKey);
      //logger.debug('User:' + user);
      //用RandomKey对用户信息做签名，产生返回给客户端的token
      var token = jwt.sign(user.toJSON(), randomKey);
      //logger.debug('Token:' + token);
      next(null, user, token, randomKey);
    };
    //记录登录状态
    var recordLoginStatus = function(user, token, key, next) {
      //Redis的key存储MD5(token)，减少key的长度
      var md5 = crypto.createHash('md5');
      md5.update(token);
      var hashedToken = md5.digest('hex')
      //logger.debug("HashedToken in login:", hashedToken)
      //Key-Value:MD5(token)-RandomKey
      //可加入原始user对象，验证verify后的结果是否一致
      db.redis.hmset(hashedToken, 'key', key, /*'user', user,*/ function (err, res) {
        if (err)
            next(error.object.databaseError);
        else {
            db.redis.expire(hashedToken, 60 * 60 * 24)
            next(null, { user: user, loginId: token });
        }
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
router.post('/logout', global.checkSession, function (req, res) {
    if (req.body.loginId && req.loginUser) {
        var token = req.body.loginId;
        var md5 = crypto.createHash('md5');
        md5.update(token);
        var hashedToken = md5.digest('hex')
        //logger.debug("HashedToken in logout:", hashedToken)
        db.redis.del(hashedToken, function (err, result) {
            if (err) {
                logger.error(error.message.server.redisWriteError + err);
                return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
            } else if (result === 1) {
                return res.status(201).jsonp({ data: {user:req.loginUser} });
            }
        });
    } else {
        return res.status(400).jsonp({ errorMessage: error.message.client.fieldRequired });
    }
});

//用户注册
router.post('/register', function (req, res) {
    if (req.body.userName && req.body.password && req.body.email) {
        //创建新用户
        User.create(req.body, function (err, user) {
            if (err) {
                logger.error(error.message.server.mongoInsertError + err);
                res.status(500).jsonp({errorMessage:error.message.client.databaseError})
            } else if (user) {
                logger.debug(user);
                res.status(201).jsonp({data:{user:user}})
            } 
        });
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
            { _id: req.loginUser._id, password: oldPasswordHash },
            { password: newPasswordHash, lastModified: Date.now() },
            { new: true, select: Model.UserFieldsForCli },
            function (err, user) {
                if (err) {
                    logger.error(error.message.internal.mongoUpdateError + err);
                    return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
                } else if (user) {
                    return res.status(201).jsonp({ data: { user: user.toJSON() } });
                } else {
                    return res.status(403).jsonp({ errorMessage: error.message.client.wrongPassword })
                }
            });
    } else {
        return res.status(400).jsonp({ errorMessage: error.message.fieldRequired });
    }
});

//用户更改简介
router.post('/modifyIntroduce', global.checkSession, function (req, res) {
    if (req.body.introduce) {
        User.findByIdAndUpdate(req.loginUser._id,
            { introduce : req.body.introduce, lastModified: Date.now() },
            { new: true, select: Model.UserFieldsForCli },
            function (err, user) {
                if (err) {
                    logger.error(error.message.server.mongoUpdateError + err);
                    return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
                } else if (user) {
                    return res.status(201).jsonp({ data: { user : user.toJSON() } });
                }
            });
    } else {
        return res.status(400).jsonp({ errorMessage: error.message.fieldRequired });
    }
});

//用户更改头像
router.post('/modifyAvator', global.checkSession, function (req, res) {
    if (req.body.imageId) {
        User.findByIdAndUpdate(req.loginUser._id,
            { avator: req.body.imageId },
            { new: true, select: Model.UserFieldsForCli },
            function (err, user) {
                if (err) {
                    logger.error(error.message.server.mongoUpdateError + err);
                    return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
                } else if (user) {
                    return res.status(201).jsonp({ data: { user: user.toJSON() } });
                }
            });
    } else {
        return res.status(400).jsonp({ errorMessage: error.message.fieldRequired });
    }
});

//用户详细信息
router.get('/getUserDetail/:userId', function (req, res) {
    User.findById(req.params.userId, Model.UserFieldsForCli,
        function (err, user) {
            if (err) {
                logger.error(exports.message.server.mongoQueryError + err);
                return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
            } else if (user) {
                return res.status(200).jsonp({ data: { user: user } });
            } else {
                return res.status(404).jsonp({ errorMessage: error.message.client.userNotFound });
            }
        });
});

module.exports = router;
