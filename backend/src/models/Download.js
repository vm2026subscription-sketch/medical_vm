const mongoose = require('mongoose');

const downloadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // null = public resource
    title: { type: String, required: true },
    fileUrl: { type: String, required: true },
    type: { type: String, enum: ['plan_pdf', 'checklist', 'seat_matrix', 'guide'], required: true },
    authority: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Download', downloadSchema);
