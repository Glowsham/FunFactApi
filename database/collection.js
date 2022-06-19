const mongoose = require('mongoose');

const collection = mongoose.Schema({
    password: {type: String}
});

collection.virtual('id').get(function(){
    return this._id.toHexString();
});
collection.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {   delete ret._id  }
});

module.exports = mongoose.model('Collection', collection);