const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'NewsNotification', default: null },
  readAt: { type: Date, required: true },
});
// A null notification is this user's "mark all read through this time" marker.
schema.index({ userId: 1, notificationId: 1 }, { unique: true });
module.exports = mongoose.model('NotificationRead', schema);
