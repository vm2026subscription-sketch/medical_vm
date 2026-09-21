const mongoose = require('mongoose');
module.exports = mongoose.model('CollegeAlias', new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  source: String,
  label: String,
  collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
}, { timestamps: true }));
