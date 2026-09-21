const mongoose = require('mongoose');
const schema = new mongoose.Schema({ ownerId: { type: mongoose.Schema.Types.ObjectId, required: true }, name: String, entity: String, mapping: mongoose.Schema.Types.Mixed, defaults: mongoose.Schema.Types.Mixed }, { timestamps: true });
schema.index({ ownerId: 1, entity: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('ImportMapping', schema);
