var app = require('../app');
var supertest = require('supertest');
var request = supertest(app);
var should = require('should');
var db = require('../routes/db');

var newItemInfo = {
	"loginId":"7faa1addadd17c2c37d54de32bdc4773",
	"name":"索尼子手办12",
	"categoryId":1,
	"secondCategoryId":2,
	"conditionId":1,
	"regionCode":1,
	"descriptionContent":"fasdfasdfasd",
	"price":33.33
};

var commonCallback = function(done) {
	return function(err, res) {
		//console.info(res.body.data);
		should.not.exist(err);
		res.status.should.equal(201);
		should(res.body.data).be.ok;
		should(res.body.data).be.an.Object;
		should(res.body.data).have.property('user');
		should(res.body.data.user).be.an.Object;
		done();
	}
};

var pageCount = 2;
var numPerPage = 5;
var listCommonCallback = function(done) {
	return function(err, res) {
		should.not.exist(err);
		res.status.should.equal(200);
		should(res.body.data).be.ok;
		should(res.body.data).be.an.Array;
		should(res.body.data).have.a.lengthOf(numPerPage);
		done();
	}
};

before(function(done) {
	console.info('before');
	db.init(done);
});

describe('Item test', function() {
	//this.timeout(15000);
	
	it('Add item for sell', function(done) {
		request.post('/Item/addItem')
			.send(newItemInfo).end(commonCallback(done));
	});
	it('Add item to buy', function(done) {
		request.post('/Item/addItemRequest')
			.send(newItemInfo).end(commonCallback(done));
	});
	it('Modify item info', function(done) {
		var modifiedInfo = {"loginId":"7faa1addadd17c2c37d54de32bdc4773",
			"itemId" : '565c01c48317683031368be7', 
			"name" : "索尼子手办13",
			 "categoryId" : 1, 
			 "secondCategoryId" : 2,
			 "conditionId" : 1, 
			 "regionCode"  : 1,
			 "descriptionContent" : "WWW" + new Date().getTime().toString(),
			 "price" : 333 
		};
		request.post('/Item/modifyItem')
			.send(modifiedInfo).end(commonCallback(done));
	});
	it('Disable item', function(done) {
		var operator = {"loginId":"7faa1addadd17c2c37d54de32bdc4773",
			"itemId" : '565c01c48317683031368be7'
		};
		request.post('/Item/disableItem')
			.send(operator).end(commonCallback(done));
	});
	it('Get item info', function(done) {
		var itemId = { "itemId" : '565c01c48317683031368be7' };
		request.get('/Item/getItemDetail').query(itemId).end(commonCallback(done));
	});
	
	describe('User Item list test', function() {
		it('Get user item list with user ID and token', function(done) {
			var query = {
				'userId':'564e9a343cbb67502eefa5af',
				'pageCount':pageCount,
				'numPerPage':numPerPage,
				'loginId':'b0032f35edf669714ece9bceaff9e822'
			};
			request.get('/Item/getUserItemList').query(query).end(listCommonCallback(done));
		});
		it('Get user item list with only user ID', function(done) {
			var query = {
				'userId':'564e9a343cbb67502eefa5af',
				'pageCount':pageCount,
				'numPerPage':numPerPage
			};
			request.get('/Item/getUserItemList').query(query).end(listCommonCallback(done));
		});
		it('Get user item list without user ID', function(done) {
			var query = {
				'pageCount':pageCount,
				'numPerPage':numPerPage,
				'loginId':'7faa1addadd17c2c37d54de32bdc4773'
			};
			request.get('/Item/getUserItemList').query(query).end(listCommonCallback(done));
		});
		it('Get user item list with paging', function(done) {
			var query = {
				'userId':'564e9a343cbb67502eefa5af',
				'pageCount':pageCount,
				'numPerPage':numPerPage,
				'nextId':'565be88ed69a3acc2e5d6d18'
			};
			request.get('/Item/getUserItemList').query(query).end(listCommonCallback(done));
		});
	});
	describe("Favorite test", function() {
		var getFavoriteList = function(listCount) {
			return function(done) {
				var query = {
					'pageCount':pageCount,
					'numPerPage':numPerPage,
					'loginId':'7faa1addadd17c2c37d54de32bdc4773'
				};
				request.get('/Item/getMyFavoriteItemList').query(query).end(function(err, res) {
					should.not.exist(err);
					res.status.should.equal(200);
					should(res.body.data).be.ok;
					should(res.body.data).be.an.Array;
					should(res.body.data).have.a.lengthOf(listCount >= 0 ? listCount : numPerPage);
					done();
				});
			};
		};
		var operationItem = {
			'itemId':'56555080e459192435608619',
			'loginId':'7faa1addadd17c2c37d54de32bdc4773'	
		};
		it('Add item to Favorite test', function(done) {
			request.post('/Item/addItemToFavorite').send(operationItem).end(commonCallback(done));
		});
		it('Get Favorite list test, should have 1 item in Favorite list', getFavoriteList(1));
		it('Remove item from Favorite test', function(done) {
			request.post('/Item/removeItemFromFavorite').send(operationItem).end(commonCallback(done));
		});
		it('Get Favorite list test, should have 0 item in Favorite list', getFavoriteList(0));
		it('Try to add item of myself, should failed', function(done) {
			var query = {
				'itemId':'5657f782e45b335830220606',
				'loginId':'7faa1addadd17c2c37d54de32bdc4773'	
			};
			request.post('/Item/addItemToFavorite').send(query).end(function(err, res) {
				should.not.exist(err);
				res.status.should.equal(400);
				done();
			});
		});
		it('Get Favorite list test, should have 0 item in Favorite list', getFavoriteList(0));
	});
});

after(function(done) {
	db.finalize(done);
})