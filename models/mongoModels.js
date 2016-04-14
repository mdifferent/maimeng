var mongoose = require('mongoose'),
    mongoosastic = require('mongoosastic'),
    _ = require('lodash'),
    logger = require('log4js').getLogger("db"),
    config = require('../config/db.json'),
    db = require('../routes/db')

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

//User model define
var UserSchema = new Schema({
    userName:                { type: String, index: { unique: true } },
    password:                String,
    email:                   { type: String, index: { unique: true } },
    phone:                   String,
    regionCode:              Number,
    introduce:               String,
    avator:                  ImageSchema,
    createdAt:               { type: Date, default: Date.now },
    lastModified:            { type: Date, default: Date.now },
    notifications:           [NotificationSchema],
    favorites:               [{ type: Schema.Types.ObjectId, ref: 'items' }]
});
var UserModel = mongoose.model('users', UserSchema)

//Item model define
var ItemSchema = new Schema({
    name:                   { type:String, es_indexed: true },
    type:                   { type:Number, es_indexed: true, es_type: 'integer'},
    disabled:               Boolean,
    regionCode:             { type:Number, es_indexed: true, es_type: 'integer' },
    f2f:                    { type:Boolean, default: false },
    sameCity:               { type:Boolean, default: false },
    descriptionContent:     String,
    price:                  Number,
    addTime:                { type: Date, default: Date.now },
    updateTime:             { type: Date, default: Date.now },
    user:                   { type: Schema.Types.ObjectId, ref: 'users' },
    images:                 { type: [ImageSchema], es_indexed: false },
    visitCount:             { type: Number, default: 0 },
});


ItemSchema.plugin(mongoosastic, {
    index: "items",
    type: "itemName",
    bulk: {
        size: 10, // preferred number of docs to bulk index
        delay: 1000 //milliseconds to wait for enough docs to meet size constraint
    },
    hosts: [config.elasticsearch.host],
    hydrate: true,
    hydrateOptions: {
        lean: true
    }
})

var ItemModel = mongoose.model('items', ItemSchema)

ItemModel.createMapping({
    index: 'items',
    type: 'itemName',
    body: {
        properties: {
            name: {
                type: 'string',
                analyzer: 'ik_syno_smart',
                search_analyzer: 'ik_syno_smart'
            },
            type: {
                type: 'integer',
                index: 'not_analyzed',
            },
            regionCode: {
                type: 'integer',
                index: 'not_analyzed',
            }
        }
    }
}, function (err, mapping) {
    if (err) {
        logger.error('error creating mapping (you can safely ignore this)');
        logger.error(err);
    } else {
        logger.info('mapping created!');
        logger.info(mapping);
    }
})

//Comment model define
var CommentSchema = new Schema({
    content:                String,
    addTime:                { type:Date, default: Date.now },
    item:                   { type: Schema.Types.ObjectId, ref: 'items' },
    user:                   { type: Schema.Types.ObjectId, ref: 'users' }
})

var CommentModel = mongoose.model('comments', CommentSchema)

module.exports = {
    User : UserModel,
    Item : ItemModel,
    Comment : CommentModel,
    UserFieldsForCli : '_id userName email phone regionCode introduce avator createdAt',
    ItemFieldsForCli : '_id name type disable categoryId secondCategoryId conditionId' 
        + ' regionCode descriptionContent price addTime updateTime user images',
};

