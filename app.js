var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('./routes/logger');
var methodOverride = require('method-override');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multer = require('multer');

//Routers
var routes = require('./routes');
var users = require('./routes/users');
var items = require('./routes/items');
var comments = require('./routes/comments');
var notifications = require('./routes/notifications');
var category = require('./routes/category');
var search = require('./routes/search');
var image = require('./routes/image');
var admin = require('./routes/admin');

var app = express();

//require('./routes/db').init();

// view engine setup
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger.express);
app.use(methodOverride());
app.use(session({ resave: true,
                  saveUninitialized: true,
                  secret: 'uwotm8' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(multer());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/User', users);
app.use('/Item',items);
app.use('/Comment',comments);
app.use('/Notification',notifications);
app.use('/Category',category);
app.use('/Search',search);
app.use('/Image',image);
app.use('/Admin',admin);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

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

app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});

module.exports = app;