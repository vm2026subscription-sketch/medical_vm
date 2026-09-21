const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // "Free" | "Season Pass" | "Pro + Expert"
    slug: { type: String, required: true, unique: true },
    price: { type: Number, required: true }, // INR rupees; billing converts to integer paise
    features: [{ type: String }],
    durationDays: { type: Number, required: true }, // e.g. season pass ~120 days
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
