var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ImageSchema = new Schema({
    id:                     String,
});

var NotificationSchema = new Schema({
    type:                   Number,
    content:                String,
    addTime:                Number,
    userId:                 { type: Schema.Types.ObjectId, ref: 'users' },
    commentId:              { type: Schema.Types.ObjectId, ref: 'comments' },
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
    userId:                 { type: Schema.Types.ObjectId, ref: 'users' },
    images:                 [ImageSchema]
});

var CommentSchema = new Schema({
    content:                String,
    addTime:                Number,
    itemId:                 { type: Schema.Types.ObjectId, ref: 'items' },
    userId:                 { type: Schema.Types.ObjectId, ref: 'users' }
});

module.exports = {
    User : mongoose.model('users', UserSchema),
    Item : mongoose.model('items', ItemSchema),
    Comment : mongoose.model('comments', CommentSchema),
    UserFieldsForCli : '_id userName email phone regionCode introduce avator createdAt',
    ItemFieldsForCli : '_id name type disable categoryId secondCategoryId conditionId' 
        + ' regionCode descriptionContent price addTime updateTime images',
};