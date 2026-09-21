const mongoose = require('mongoose');
module.exports = mongoose.model('CatalogLock', new mongoose.Schema({ _id: String, revision: { type: Number, default: 0 } }));
