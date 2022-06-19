const mongoose = require('mongoose');

const subject = mongoose.Schema({
    title: {type: String},
    elementId: {type: String},
    position: {type: Number}
});

subject.virtual('id').get(function(){
    return this._id.toHexString();
});
subject.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {   delete ret._id  }
});

module.exports = mongoose.model('Subject', subject);