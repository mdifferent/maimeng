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

//用户登录
router.post('/login', function (req, res) {
  if (req.body.input && req.body.password) {
    var queryFilter = { $or: [{ userName: req.body.input }, 
                              { email: req.body.input }], 
                        password: req.body.password };                  
    //读取用户数据
    var checkAccount = function (next) {
      db.mongo.collection('users').find(queryFilter, global.userObjectFields).limit(1)
        .toArray(function (err, docs) {
          logger.debug(docs);
          if (err) {
            logger.error(exports.message.server.mongoQueryError + err);
            next(error.object.databaseError);
          } else if (docs.length === 1) {
            next(null, docs[0]);
          } else {
            next({ status: 404, errorMessage: error.message.userNotFound });
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
    var data = req.body;
    data.createdAt = new Date().getTime();
    //检测用户名是否已存在
    var checkUserExist = function (callback) {
      db.mongo.collection('users').find({ $or: [{ uesrName: req.body.userName }, { email: req.body.email }] })
        .limit(1).toArray(function (err, docs) {
          if (err) {
            logger.error(exports.message.server.mongoQueryError + err);
            callback(error.object.databaseError, null);
          } else if (docs.length > 0) {
            callback({ status: 400, msg: error.message.client.usernameExist }, null);
          } else {
            callback(null);
          }          
        });
    };
    //创建新用户
    var createAccount = function (callback) {
      db.mongo.collection('users').insertOne(data, function (err, result) {
        if (err) {
          logger.error(exports.message.server.mongoInsertError + err);
          callback(error.object.databaseError, null);
        } else if (result.insertedCount === 1) {
          logger.debug(result);
          callback(null, result.ops[0]);
        } else {
          callback(error.object.databaseError, null);
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
    //更新密码
    var updateNewPassword = function (next) {
      var oldPasswordHash = req.body.oldPassword;
      var newPasswordHash = req.body.password;  //TODO : server side crypto
      db.mongo.collection('users').findOneAndUpdate(
        { _id: ObjectId(req.loginUser._id), password:oldPasswordHash }, 
        { $set: { password: newPasswordHash },
          $currentDate: { "updateTime": true }}, 
        { projection : global.userObjectFields, 
          returnOriginal:false },
        global.callbacks.mongoUpdate(next));
    };
    async.waterfall([updateNewPassword], updateCommonCallback(res));
  } else {
    return res.status(400).jsonp({ errorMessage: error.message.fieldRequired });
  }
});

//用户更改简介
router.post('/modifyIntroduce', global.checkSession, function (req, res) {
  var operation = function (next) {
    db.mongo.collection('users').findOneAndUpdate(
      { _id: ObjectId(req.loginUser._id) }, 
      { $set: { introduce: req.body.introduce },
        $currentDate: { "updateTime": true }},
      { projection : global.userObjectFields, 
        returnOriginal:false },
      global.callbacks.mongoUpdate(next));
  };
  async.waterfall([operation], updateCommonCallback(res));
});

//用户更改头像
router.post('/modifyAvator', global.checkSession, function (req, res) {

});

//用户详细信息
router.get('/getUserDetail', function (req, res) {
  db.mongo.collection('users').find({ _id: ObjectId(req.query.userId) }, global.userObjectFields)
    .limit(1).toArray(function (err, docs) {
      logger.debug(docs);
      if (err) {
        logger.error(exports.message.server.mongoQueryError + err);
        return res.status(500).jsonp({ errorMessage: error.message.client.databaseError });
      } else if (docs.length > 0) {
        return res.status(200).jsonp({ data: { user: docs[0] } });
      } else {
        return res.status(404).jsonp({ errorMessage: error.message.client.userNotFound });
      }
    });
});

module.exports = router;
