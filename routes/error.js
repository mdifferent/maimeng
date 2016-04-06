
module.exports.message = {
	client : {
		databaseError : '数据库错误',
		emailUsed : '已经使用该Email注册过',
		fieldRequired : '缺少必要的字段',
		noUpdate : '没有记录被更新',
		sessionTimeout : '会话过期，请重新登录',
		tokenRequired : '缺少loginId',
		usernameExist : '用户名已存在',
		userNotFound : '未找到该用户',
        notYours : '没有该操作的权限',
        wrongPassword: '密码错误'
	}, 
	
	server : {
		mongoQueryError : 'MongoDB query error:',
		mongoInsertError : 'MongoDB insert error:',
		mongoUpdateError : 'MongoDB update error:',
		mongoDeleteError : 'MongoDB delete error:',
		redisReadError : 'Redis read error:',
		redisWriteError : 'Redis write error:',
		
	}
};

module.exports.object = {
	databaseError : {status:500, errorMessage: '数据库错误'},
	fieldRequired : {status:400, errorMessage: '缺少必要的字段'},
	favorateSelf : {status:400, errorMessage: '无法收藏自己发布的物品'},
    userNotFound : {status:404, errorMessage: '未找到该用户'},
    userNameDuplicate : {status:400, errorMessage: '用户名或email已被使用'},
    itemNotFound : {status:404, errorMessage: '未找到该商品'},
    notYours:{status:403, errorMessage: '没有该操作权限'},
    duplicateFavor: {status:400, errorMessage: '已经收藏过了'},
    favorNotExist: {status:400, errorMessage: '未收藏该物品'}
};

