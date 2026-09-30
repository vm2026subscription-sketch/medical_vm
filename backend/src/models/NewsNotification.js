const mongoose = require('mongoose');

const newsNotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // null = broadcast
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, enum: ['deadline', 'premium_alert', 'general', 'booking'], default: 'general' },
    isRead: { type: Boolean, default: false },
    targetState: { type: String },
    targetCourse: { type: String },
    scheduledFor: { type: Date },
    attachments: [{
      name: { type: String, required: true, trim: true, maxlength: 180 },
      url: { type: String, required: true },
      mime: { type: String, maxlength: 120 },
      size: { type: Number, min: 0 },
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('NewsNotification', newsNotificationSchema);
