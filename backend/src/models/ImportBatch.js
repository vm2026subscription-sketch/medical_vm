const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  entity: { type: String, required: true },
  source: { type: String, required: true },
  sourceUrl: String,
  filename: String,
  fileId: mongoose.Schema.Types.ObjectId,
  sheet: String,
  sheets: [String],
  headers: [String],
  mapping: mongoose.Schema.Types.Mixed,
  defaults: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['draft', 'needs_correction', 'ready', 'submitted', 'rejected', 'published'], default: 'draft', index: true },
  revision: { type: Number, default: 0 },
  totals: mongoose.Schema.Types.Mixed,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNote: String,
  publishedAt: Date,
}, { timestamps: true });
module.exports = mongoose.model('ImportBatch', schema);
