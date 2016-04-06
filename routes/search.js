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
    logger.info(req.query.keyword)
    var options = {
        hostname : config.elasticsearch.hostname,
        port : config.elasticsearch.port,
        path : '/items/itemName/_search?analyzer=ik_syno_smart&field=name&text=kancolle', 
//            + req.query.keyword,
        method : 'GET'
    }
    logger.info(options.path)
    var searchInEla = function(next) {
        var req2Ela = http.request(options, function(res) {
            res.setEncoding('utf8')
            res.on('data', function(chunk) {
                var ids = []
                logger.debug(chunk)
                var hits = JSON.parse(chunk).hits.hits
                _.forEach(hits, function(hit) {
                    ids.push(hit._id)
                })
                next(null, ids)
            })
        })
        req2Ela.end()
    }
    var getItem = function(itemIds, next) {
        Item.find({_id:{$in:itemIds}}, Model.ItemFieldsForCli)
            .populate('user', Model.UserFieldsForCli)
            .exec(function(err, items) {
                if (err) {
                    logger.error(error.message.server.mongoQueryError + err);
                    next(error.object.databaseError);
                } else if (items) {
                    next(null, items);                            
                } else {
                    next(error.object.itemNotFound);
                }
            });
    }
    async.waterfall([searchInEla, getItem], function(err, results) {
        if (err) {
            return res.status(err.status).jsonp({errorMessage:err.errorMessage});
        } else if (results && results.length > 0) {
            return res.status(200).jsonp({
                data:{
                    nextId:results.slice(-1)[0]._id, 
                    pageCount:req.query.pageCount, 
                    itemList:results
                }})           
        } else {
            return res.status(200).jsonp({
                data:{
                    nextId:0, 
                    pageCount:req.query.pageCount, 
                    itemList:[]
                }}) 
        }
    })
    /*
    Item.search({
        query_string: {
            default_field: "title",
            query: req.query.keyword,
            analyzer: "ik_syno_smart"
        }
    }, function(err, result) {
        if (err) {
            logger.error(error.message.server.mongoQueryError + err)
            return res.status(500).json({errorMessage:error.object.databaseError})
        } else {
            logger.info(result)
            return res.status(200).jsonp({data:result})
        }
    });*/
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