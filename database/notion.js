const mongoose = require('mongoose');

const notion = mongoose.Schema({
    title: {type: String},
    elementId: {type: String},
    position: {type: Number}
});

notion.virtual('id').get(function(){
    return this._id.toHexString();
});
notion.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {   delete ret._id  }
});

module.exports = mongoose.model('Notion', notion);