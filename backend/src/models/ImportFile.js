const mongoose = require('mongoose');
module.exports = mongoose.model('ImportFile', new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  filename: String,
  content: { type: Buffer, required: true, select: false },
}, { timestamps: true }));
