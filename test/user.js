var should = require('should');
var app = require('../app');
var supertest = require('supertest');
var request = supertest(app);

var loginId = null;
var userId = null;
var userName = "testUser" + new Date().getTime().toString();
var userInfo = {
    userName: userName,
    password: "testUserPassword",
    email: userName + "@testing.com"
};

describe('User testing', function () {
    var loginFunc = function (done) {
        request.post("/User/login").send({
            input: userName,
            password: "testUserPassword"
        }).end(function (err, res) {
            should.not.exist(err);
            res.status.should.equal(201);
            should(res.body.data).have.property('user');
            should(res.body.data.user).be.an.Object;
            should(res.body.data).have.property('loginId');
            should(res.body.data.loginId).be.a.String;
            loginId = res.body.data.loginId;
            done();
        });
    };
    var logoutFunc = function (done) {
        request.post("/User/logout").send({
            loginId: loginId
        }).end(function (err, res) {
            should.not.exist(err);
            res.status.should.equal(201);
            should(res.body.data).have.property('user');
            should(res.body.data.user).be.an.Object;
            loginId = null;
            done();
        });
    };


    describe('User register testing', function () {
        it('Register success', function (done) {
            request.post("/User/register").send(userInfo).end(function (err, res) {
                should.not.exist(err);
                res.status.should.equal(201);
                should(res.body.data).have.property('user');
                should(res.body.data.user).be.an.Object;
                done();
            });
        });

        it('Register without enough info', function (done) {
            request.post("/User/register").send({
                userName: "wrongName",
                password: "testUserPassword"
            }).end(function (err, res) {
                should.not.exist(err);
                res.status.should.equal(400);
                done();
            });
        });

        it('Duplicate user info', function (done) {
            request.post("/User/register").send(userInfo).end(function (err, res) {
                should.not.exist(err);
                res.status.should.equal(500);
                done();
            });
        });
    });
    
    describe('User login testing', function () {
        it('Login success', loginFunc);
        it('Logout success', logoutFunc);
        it('Login with wrong info', function (done) {
            request.post("/User/login").send({
                input: userName,
                password: "wrongPassword"
            }).end(function (err, res) {
                should.not.exist(err);
                res.status.should.equal(404);
                done();
            });
        });
    });

    describe('User change info testing', function () {
        before('Login', loginFunc);

        it('Change password with correct old password', function (done) {
            request.post("/User/modifyPassword").send({
                loginId: loginId,
                oldPassword: "testUserPassword",
                password: "testUserPassword1"
            }).end(function (err, res) {
                should.not.exist(err);
                res.status.should.equal(201);
                should(res.body.data).have.property('user');
                should(res.body.data.user).be.an.Object;
                done();
            });
            
        });

        it('Logout', logoutFunc);

        it('Login with new password should success', function (done) {
            request.post("/User/login").send({
                input: userName,
                password: "testUserPassword1"
            }).end(function (err, res) {
                should.not.exist(err);
                res.status.should.equal(201);
                should(res.body.data).have.property('user');
                should(res.body.data.user).be.an.Object;
                should(res.body.data).have.property('loginId');
                should(res.body.data.loginId).be.a.String;
                loginId = res.body.data.loginId;
                done();
            });
        });

        it('Change password with wrong old password', function (done) {
            request.post("/User/modifyPassword").send({
                loginId: loginId,
                oldPassword: "testUserPassword",
                password: "testUserPassword2"
            }).end(function (err, res) {
                should.not.exist(err);
                res.status.should.equal(403);
                done();
            });
        });

        it('Logout', logoutFunc);

        it('Login with new password should failed', function (done) {
            request.post("/User/login").send({
                input: userName,
                password: "testUserPassword2"
            }).end(function (err, res) {
                should.not.exist(err);
                res.status.should.equal(404);
                done();
            });
        });

        it('Login with new password should success', function (done) {
            request.post("/User/login").send({
                input: userName,
                password: "testUserPassword1"
            }).end(function (err, res) {
                should.not.exist(err);
                res.status.should.equal(201);
                should(res.body.data).have.property('user');
                should(res.body.data.user).be.an.Object;
                should(res.body.data).have.property('loginId');
                should(res.body.data.loginId).be.a.String;
                loginId = res.body.data.loginId;
                done();
            });
        });

        it('Reset password', function (done) {
            request.post("/User/modifyPassword").send({
                loginId: loginId,
                oldPassword: "testUserPassword1",
                password: "testUserPassword"
            }).end(function (err, res) {
                should.not.exist(err);
                res.status.should.equal(201);
                done();
            });
        });
        after('Logout', logoutFunc);
    });

    describe('User basic info testing', function () {
        before('Login', loginFunc);
        it('Modify introduction : new', function (done) {
            request.post('/User/modifyIntroduce').send({
                introduce: "This is my introduction!",
                loginId: loginId
            }).end(function (err, res) {
                should.not.exist(err);
                res.status.should.equal(201);
                should(res.body.data).have.property('user');
                should(res.body.data.user).be.an.Object;
                should(res.body.data.user).have.property('introduce');
                should(res.body.data.user.introduce).be.an.String;
                should(res.body.data.user.introduce).be.equal("This is my introduction!");
                userId = res.body.data.user._id.toString();
                done();
            });
        });
        it('Modify introduction : replace', function (done) {
            request.post('/User/modifyIntroduce').send({
                introduce: "This is also my introduction!",
                loginId: loginId
            }).end(function (err, res) {
                should.not.exist(err);
                res.status.should.equal(201);
                should(res.body.data).have.property('user');
                should(res.body.data.user).be.an.Object;
                should(res.body.data.user).have.property('introduce');
                should(res.body.data.user.introduce).be.an.String;
                should(res.body.data.user.introduce).be.equal("This is also my introduction!");
                done();
            });
        });
        it('Get info', function (done) {
            request.get('/User/getUserDetail/' + userId).end(function (err, res) {
                should.not.exist(err);
                res.status.should.equal(200);
                should(res.body.data).have.property('user');
                should(res.body.data.user).be.an.Object;
                done();
            });
        })
        after('Logout', logoutFunc)
    })
})
