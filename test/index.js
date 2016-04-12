var should = require('should'),
    app = require('../app'),
    supertest = require('supertest'),
    request = supertest(app),
    values = require('../config/values')


var user = {
    userName: "indexUser",
    password: "indexUserPassword",
    email: "indexUser@testing.com"
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

describe('Index test', function () {
    before('Login', function (done) {
        var loginInfo = {
            input: user.userName,
            password: user.password
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

    it('Test latest item', function (done) {
        request.get("/latestItems").query({
            itemType: values.TO_BUY,
            pageCount: 1,
            numPerPage: 10
        }).end(function (err, res) {
            should.not.exist(err);
            res.status.should.equal(200);
            done();
        })
    })

})    