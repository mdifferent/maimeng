var app = require('../app');
var supertest = require('supertest');
var request = supertest(app);
var should = require('should');
var db = require('../routes/db');

before(function(done) {
	console.info('before');
	db.init(done);
});

describe('Item comment test', function () {
	it('Add comment to item', function(done) {
		request.post('/Comment/addItemComment').send({
			loginId:"7faa1addadd17c2c37d54de32bdc4773",
			itemId:"56555080e459192435608619",
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
		});
		done();
	});
	it('Get comment list of item', function(done) {
		request.get('/Comment/getItemCommentList').query({
			itemId:"56555080e459192435608619",
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
					should(ele).have.property('user');
					should(ele).be.an.Object;
					should(ele).have.property('item');
					should(ele).be.an.Object;
				});
				should(res.body.data).have.property('nextId');
				should(res.body.data.nextId).be.an.String;
			}
		});
		done();
	});
});

after(function(done) {
	db.finalize(done);
})