const mongoose = require('mongoose');

const note = mongoose.Schema({
    content: {
    	short: {type: String},
    	full: {type: String}
    },
    importancy: {type: Number},
    elementId: {type: String},
    position: {type: Number}
});

note.virtual('id').get(function(){
    return this._id.toHexString();
});
note.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {   delete ret._id  }
});

module.exports = mongoose.model('Note', note);