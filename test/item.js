var should = require('should');
var app = require('../app');
var supertest = require('supertest');
var request = supertest(app);

var loginId = null
var itemId = null
var userId = null
var nextId = null

var user = {
    userName: "itemTestUser",
	password: "itemTestUserPassword",
	email: "itemTestUser@testing.com"
}

var commonCallback = function(done) {
	return function(err, res) {
		should.not.exist(err);
		res.status.should.equal(201);
		should(res.body.data).be.ok;
		should(res.body.data).be.an.Object;
		should(res.body.data).have.property('item');
        should(res.body.data.item).be.an.Object;
        should(res.body.data.item).have.property('user');
		should(res.body.data.user).be.an.Object;
        itemId = res.body.data.item._id
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
        should(res.body.data).have.property('nextId');
        should(res.body.data.nextId).be.a.String;
        should(res.body.data).have.property('pageCount');
        should(res.body.data.pageCount).be.a.Number;
        should(res.body.data).have.property('itemList');
		should(res.body.data.itemList).be.an.Array;
        nextId = res.body.data.nextId
		done();
	}
}

before('Registering user...', function (done) {
    request.post("/User/register").send(user).end(function(err, res) {
        done()
    })
})

describe('Item test', function() {
    before(function(done) {
        request.post("/User/login").send({
            input : user.userName,
            password : user.password
        }).end(function(err, res) {
            should.not.exist(err);
            res.status.should.equal(201);
            should(res.body.data).have.property('user');
            should(res.body.data.user).be.an.Object;
            should(res.body.data).have.property('loginId');
            should(res.body.data.loginId).be.a.String;
            loginId = res.body.data.loginId
            userId = res.body.data.user._id
            done()
        })
    })
    
    var newItemInfo = {
        "name":"索尼子手办12",
        "regionCode":1,
        "descriptionContent":"fasdfasdfasd",
        "price":33.33
    };
    
    describe('Basic item test', function() {
        it('Add item for sell', function(done) {
            newItemInfo.loginId = loginId
            request.post('/Item/addItem').send(newItemInfo).end(commonCallback(done));
        });
        
        it('Add item to buy', function(done) {
            newItemInfo.loginId = loginId
            request.post('/Item/addItemRequest').send(newItemInfo).end(commonCallback(done));
        });
        it('Modify item info', function(done) {
            var modifiedInfo = {"loginId":loginId,
                "itemId" : itemId, 
                "name" : "索尼子手办13",
                "regionCode"  : 1,
                "descriptionContent" : "WWW" + new Date().getTime().toString(),
                "price" : 333 
            };
            request.post('/Item/modifyItem').send(modifiedInfo).end(commonCallback(done));
        });
        it('Disable item', function(done) {
            request.post('/Item/disableItem').send({
                loginId: loginId,
                itemId: itemId
            }).end(commonCallback(done));
        });
        it('Get item info', function(done) {
            request.get('/Item/getItemDetail/' + itemId).end(function(err, res) {
                should.not.exist(err);
                res.status.should.equal(200);
                should(res.body.data).be.ok;
                should(res.body.data).be.an.Object;
                should(res.body.data).have.property('item');
                should(res.body.data.item).be.an.Object;
                //should(res.body.data.item).have.property('user');
                //should(res.body.data.user).be.an.Object;
                itemId = res.body.data.item._id
                done();
            });
        });
    })

	describe('User Item list test', function() {
		it('Get user item list with user ID and token', function(done) {
			var query = {
				'userId':userId,
				'pageCount':pageCount,
				'numPerPage':numPerPage,
				'loginId':loginId
			};
			request.get('/Item/getUserItemList').query(query).end(listCommonCallback(done));
		});
		it('Get user item list with only user ID', function(done) {
			var query = {
				'userId':userId,
				'pageCount':pageCount,
				'numPerPage':numPerPage
			};
			request.get('/Item/getUserItemList').query(query).end(listCommonCallback(done));
		});
		it('Get user item list without user ID', function(done) {
			var query = {
				'pageCount':pageCount,
				'numPerPage':numPerPage,
				'loginId':loginId
			};
			request.get('/Item/getUserItemList').query(query).end(listCommonCallback(done));
		});
		it('Get user item list with paging', function(done) {
			var query = {
				'userId':userId,
				'pageCount':pageCount,
				'numPerPage':numPerPage,
				'nextId':nextId
			};
			request.get('/Item/getUserItemList').query(query).end(listCommonCallback(done));
		});
	});
    
	describe("Favorite test", function() {
        var userFavLoginId = null
        var userFavId = null
		var operationItem = {}
        var userFav = {
            userName: "testUser1",
            password: "testUser1Password",
            email: "testUser1@testing.com"
        }
        
        before('Registering user for favorite testing...', function (done) {
            request.post("/User/register").send(userFav).end(function (err, res) {
                done();
            });
        });
        before('User login for favorite testing...', function (done) {
            request.post("/User/login").send({
                input: userFav.userName,
                password: userFav.password
            }).end(function (err, res) {
                userFavLoginId = res.body.data.loginId
                userFavId = res.body.data.user._id
                done()
            })
        })
        
        it('Publish item for Favorite test', function(done) {
            newItemInfo.loginId = userFavLoginId
            request.post('/Item/addItem').send(newItemInfo).end(commonCallback(done));
        })
		it('Add item to Favoritelist', function(done) {
            operationItem.itemId = itemId
            operationItem.loginId = loginId
			request.post('/Item/addItemToFavorite').send(operationItem).end(commonCallback(done));
		});
        it('Get Favorite list test, should have 1 item in Favorite list', function (done) {
            request.get('/Item/getMyFavoriteItemList').query({
                pageCount: pageCount,
                numPerPage: numPerPage,
                loginId: userFavLoginId
            }).end(listCommonCallback(done));
        });
		it('Remove item from Favorite test', function(done) {
			request.post('/Item/removeItemFromFavorite').send(operationItem).end(commonCallback(done));
		});
		it('Get Favorite list test, should have 0 item in Favorite list', function (done) {
            request.get('/Item/getMyFavoriteItemList').query({
                pageCount: pageCount,
                numPerPage: numPerPage,
                loginId: userFavLoginId
            }).end(listCommonCallback(done));
        });
        
        it('Publish item for Favorite test', function(done) {
            newItemInfo.loginId = loginId
            request.post('/Item/addItem').send(newItemInfo).end(commonCallback(done));
        })
		it('Try to add item of myself, should failed', function(done) {
			operationItem.itemId = itemId
            operationItem.loginId = loginId
			request.post('/Item/addItemToFavorite').send(operationItem).end(function(err, res) {
				should.not.exist(err);
				res.status.should.equal(400);
				done();
			});
		});
		it('Get Favorite list test, should have 0 item in Favorite list', function (done) {
            request.get('/Item/getMyFavoriteItemList').query({
                pageCount: pageCount,
                numPerPage: numPerPage,
                loginId: loginId
            }).end(listCommonCallback(done));
        });
        
        after(function (done) {
            request.post("/User/logout").send({
                loginId: userFavLoginId
            }).end(function (err, res) {
                userFavLoginId = null;
            });
            done();
        })
	});
    
    after(function(done) {
        request.post("/User/logout").send({
			loginId: loginId
		}).end(function (err, res) {
			loginId = null;
            done()
		})
    })
})