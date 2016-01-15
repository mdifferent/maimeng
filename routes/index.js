var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/latest', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/recommanded', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
