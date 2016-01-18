var mongoose = require('mongoose');
var logger = require('log4js').getLogger("db");
var _ = require('lodash');
var config = require('../config/db.json');
var db = mongoose.connection;
mongoose.connect(config.mongoUrl, config.mongoConfig);
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    logger.info('MongoDB connect success : ' + config.mongoUrl);
    logger.info('MongoDB check collections...' + config.mongoUrl);
    checkCollections();
});
var Schema = mongoose.Schema;

var ImageSchema = new Schema({
    id:                     String,
});

var NotificationSchema = new Schema({
    type:                   Number,
    content:                String,
    addTime:                { type: Date, default: Date.now },
    user:                   { type: Schema.Types.ObjectId, ref: 'users' },
    comment:                { type: Schema.Types.ObjectId, ref: 'comments' },
});

var UserSchema = new Schema({
    userName:                String,
    password:                String,
    email:                   String,
    phone:                   String,
    regionCode:              Number,
    introduce:               String,
    avator:                  ImageSchema,
    createdAt:               { type: Date, default: Date.now },
    lastModified:            { type: Date, default: Date.now },
    notifications:           [NotificationSchema],
    favorites:               [{ type: Schema.Types.ObjectId, ref: 'items' }]
});

var ItemSchema = new Schema({
    name:                   String,
    type:                   Number,
    disabled:               Boolean,
    regionCode:             Number,
    descriptionContent:     String,
    price:                  Number,
    addTime:                { type: Date, default: Date.now },
    updateTime:             { type: Date, default: Date.now },
    user:                   { type: Schema.Types.ObjectId, ref: 'users' },
    images:                 [ImageSchema]
});

var CommentSchema = new Schema({
    content:                String,
    addTime:                { type:Date, default: Date.now },
    item:                   { type: Schema.Types.ObjectId, ref: 'items' },
    user:                   { type: Schema.Types.ObjectId, ref: 'users' }
});

module.exports = {
    User : mongoose.model('users', UserSchema),
    Item : mongoose.model('items', ItemSchema),
    Comment : mongoose.model('comments', CommentSchema),
    UserFieldsForCli : '_id userName email phone regionCode introduce avator createdAt',
    ItemFieldsForCli : '_id name type disable categoryId secondCategoryId conditionId' 
        + ' regionCode descriptionContent price addTime updateTime images',
};

var mongoCollections = ['users','items','comments'];
function checkCollections(next) {
    db.db.listCollections().toArray(function(err, cols) {
        _.each(mongoCollections, function(colName) {
            if (_.find(cols, {'name': colName})) {
                logger.info(colName + ' found');
            } else {
                db.db.collection(colName);
                logger.info(colName + ' created');
            }
        })
    });
}