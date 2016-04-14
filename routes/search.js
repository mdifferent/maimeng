var express = require('express'),
    router = express.Router(),
    global = require('./global'),
    values = require('../config/values'),
    error = require('./error'),
    async = require('async'),
    _ = require('lodash'),
    logger = require('log4js').getLogger("search"),
    Model = require('../models/mongoModels'),
    Item = require('../models/mongoModels').Item,
    config = require('../config/db.json'),
    http = require('http')

function searchItemCommon(req, res, itemType) {
    Item.search({
        query_string: {
            default_field: "name",
            query: req.query.keyword
        }
    }, function(err, result) {
        if (err) {
            logger.error(error.message.server.mongoQueryError + err)
            res.status(500).json({errorMessage:error.object.databaseError})
        } else {
            logger.info(result)
            res.status(200).jsonp({data:result})
        }
    });
}
//搜索物品
router.get('/searchItem', function(req, res) {
	searchItemCommon(req, res, values.TO_SELL);
});

//搜索求物
router.get('/searchItemRequest', function(req, res) {
	searchItemCommon(req, res, values.TO_BUY);
});


module.exports = router;