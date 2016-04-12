var express = require('express'),
    app = express(),
    path = require('path'),
    favicon = require('serve-favicon'),
    log4js = require('log4js'),
    jwt = require('jsonwebtoken'),
    crypto = require('crypto'),
    methodOverride = require('method-override'),
    session = require('express-session'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    multer = require('multer'),
    config = require('./config/db.json'),
    error = require('./routes/error'),
    logger = require('log4js').getLogger("app"),
    db = require('./routes/db')

//Routers
var index = require('./routes/index'),
    users = require('./routes/users'),
    items = require('./routes/items'),
    comments = require('./routes/comments'),
    notifications = require('./routes/notifications'),
    category = require('./routes/category'),
    search = require('./routes/search'),
    image = require('./routes/image'),
    admin = require('./routes/admin')

var app = express();
log4js.configure("./config/log4js.json");
var log = log4js.getLogger("app");

// view engine setup
app.set('port', process.env.PORT || config.port);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(log4js.connectLogger(log4js.getLogger("http"), { level: 'auto' }));
app.use(methodOverride());
app.use(session({ resave: true,
                  saveUninitialized: true,
                  secret: 'uwotm8' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// login check
app.use(function(req, res, next) {
   //logger.debug(req); 
   var token = req.body.loginId || req.query.loginId;
   //logger.debug("App token:", token);
   if (token) {
       var md5 = crypto.createHash('md5');
       md5.update(token);
       var hashedToken = md5.digest('hex');
       //logger.debug(hashedToken)
       db.redis.hget(hashedToken, "key", function(err, key) {
           if (err) {
               res.status(400).jsonp({errorMessage:error.message.client.sessionTimeout});
               log.error(error.message.server.redisReadError + err);
           } else if (key) {
               jwt.verify(token, key, function(err, decoded) {
                   logger.debug('User:' + decoded);
                   if (err) {
                       log.error("Token verify error:" + err);
                       res.status(400).jsonp({errorMessage:error.message.client.sessionTimeout});
                   } else {
                       req.loginUser = decoded;
                       next();
                   }
               });
           } else {
               res.status(400).jsonp({errorMessage:error.message.client.tokenRequired});
           }
       });
   } else {
       next();
   }
});


// error handlers
/*
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});*/

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

app.use('/', index);
app.use('/User', users);
app.use('/Item',items);
app.use('/Comment',comments);
app.use('/Notification',notifications);
app.use('/Category',category);
app.use('/Search',search);
app.use('/Image',image);
app.use('/Admin',admin);

app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});

module.exports = app;
