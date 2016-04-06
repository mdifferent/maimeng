var app = require('../app');
var supertest = require('supertest');
var request = supertest(app);
var should = require('should');
var db = require('../routes/db')

var user = {
    userName: "commentUser",
	password: "commentUserPassword",
	email: "commentUser@testing.com"
}

var newItemInfo = {
    "loginId": "",
    "name": "索尼子手办12",
    "regionCode": 1,
    "descriptionContent": "fasdfasdfasd",
    "price": 33.33
}

var loginId = null
var itemId = null
var userId = null


before('Registering user...', function (done) {
    console.info('Registering user...')
    request.post("/User/register").send(user).end(function (err, res) {
        done();
    });
});

describe('Item comment test', function () {
    before('Login', function (done) {
        var loginInfo = {
            input : user.userName,
            password : user.password
        }
        request.post("/User/login").send(loginInfo).end(function (err, res) {
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
    
    it('Add item for sell', function (done) {
        newItemInfo.loginId = loginId
        request.post('/Item/addItem').send(newItemInfo).end(function (err, res) {
            should.not.exist(err);
            res.status.should.equal(201);
            should(res.body.data).be.ok;
            should(res.body.data).be.an.Object;
            should(res.body.data).have.property('item');
            should(res.body.data.item).be.an.Object;
            should(res.body.data.item).have.property('user');
            should(res.body.data.item.user).be.an.Object;
            itemId = res.body.data.item._id
            done();
        });
    });
    
	it('Add comment to item', function(done) {
		request.post('/Comment/addItemComment').send({
			loginId:loginId,
			itemId:itemId,
			content:"This is comment!"
		}).end(function(err, res) {
			should.not.exist(err);
			res.status.should.equal(201);
			should(res.body.data).have.property('itemComment');
			should(res.body.data.itemComment).be.an.Object;
			should(res.body.data.itemComment).have.property('user');
			should(res.body.data.itemComment.user).be.an.Object;
			should(res.body.data.itemComment).have.property('item');
			should(res.body.data.itemComment.item).be.an.Object;
            done();
		});
	});
    
	it('Get comment list of item', function(done) {
		request.get('/Comment/getItemCommentList').query({
            loginId: loginId,
			itemId: itemId,
            numPerPage: 10,
			pageCount:2,
			nextId:""
		}).end(function(err, res) {
			should.not.exist(err);
			res.status.should.equal(200);
			should(res.body.data).have.property('itemCommentList');
			should(res.body.data.itemCommentList).be.an.Array;
			should(res.body.data).have.property('pageCount');
			should(res.body.data.pageCount).be.an.Number;
			if (res.body.data.itemCommentList.length > 0) {
				res.body.data.itemCommentList.forEach(function(ele) {
					should(ele).have.property('item');
					should(ele.item).be.an.Object;
                    should(ele.item).have.property('user');
					should(ele.item.user).be.an.Object;
				});
			}
            done();
		});
	});
    
    after('Logout', function(done) {
        request.post("/User/logout").send({
			loginId: loginId
		}).end(function (err, res) {
			loginId = null
            itemId = null
            done()
		});
    })
})