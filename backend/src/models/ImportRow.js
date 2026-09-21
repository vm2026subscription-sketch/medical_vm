const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  row: { type: Number, required: true },
  input: mongoose.Schema.Types.Mixed,
  override: mongoose.Schema.Types.Mixed,
  mapped: mongoose.Schema.Types.Mixed,
  prepared: mongoose.Schema.Types.Mixed,
  rowErrors: [String],
}, { timestamps: true });
schema.index({ batchId: 1, row: 1 }, { unique: true });
module.exports = mongoose.model('ImportRow', schema);
