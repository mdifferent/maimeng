var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/latestItems', function(req, res, next) {
  
});

router.get('/recommandedItems', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/topItems', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
