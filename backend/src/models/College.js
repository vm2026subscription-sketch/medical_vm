const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema(
  {
    collegeCode: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
    name: { type: String, required: true, index: true },
    city: { type: String, required: true, index: true },
    state: { type: String, required: true, index: true },
    ownership: { type: String, enum: ['govt', 'private', 'deemed'], required: true, index: true },
    affiliation: { type: String },
    nmcApproved: { type: Boolean, default: true },
    images: [{ type: String }],
    facilities: [{ type: String }],
    location: {
      lat: Number,
      lng: Number,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

collegeSchema.index({ name: 'text', city: 'text', state: 'text' });

module.exports = mongoose.model('College', collegeSchema);
