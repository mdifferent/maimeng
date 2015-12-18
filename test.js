var async = require('async');
var aa = {};
aa['fads'] = 1;
aa['fdsf'] = 2;
aa['fsdfa'] = 3;
async.each(Object.keys(aa), function(p, callback) {
	console.log(p);
	callback();
}, function(err, callback) {
	console.log('finish');
})