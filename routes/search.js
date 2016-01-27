var express = require('express')
   ,router = express.Router()
   ,global =  require('./global')
   ,logger = require('log4js').getLogger("item")
   ,Item = require('../models/mongoModels').Item

function searchItemCommon(req, res, itemType) {
    Item.search({
        query_string: {
            query: req.query.keyword
        }
    }, function(err, result) {
        
    });
    /*
	mongo.collection('items')
		.find({type : itemType, disable : 0, _id : {$gt:req.query.nextId}, $text : { $search: req.query.keyword } },
				{ score : { $meta: "textScore" } })
		.sort({score: { $meta: "textScore" }, _id:1, updateTime:1})
		.limit(req.query.numPerPage)
		.toArray(function(err, docs) {
			if (err) {
				console.error('MongoDB query error : ' + err);
				return res.status(500).json({errorMessage:err});
			} else if (docs) {
				return res.status(200).json({data:{itemList:docs,nextId:docs.slice(-1)._id,pageCount:req.query.pageCount}});
			}					
		});*/
}
//搜索物品
router.get('searchItem', function(req, res) {
	searchItemCommon(req, res, global.itemType.forSell);
});

//搜索求物
router.get('searchItemRequest', function(req, res) {
	searchItemCommon(req, res, global.itemType.forBuy);
});


module.exports = router;