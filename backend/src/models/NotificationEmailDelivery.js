const mongoose = require('mongoose');

const notificationEmailDeliverySchema = new mongoose.Schema(
  {
    notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'NewsNotification', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    error: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

notificationEmailDeliverySchema.index({ notificationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('NotificationEmailDelivery', notificationEmailDeliverySchema);
