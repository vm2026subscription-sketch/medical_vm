const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    status: { type: String, enum: ['pending', 'active', 'expired', 'cancelled'], default: 'pending', index: true },
    startDate: { type: Date },
    expiryDate: { type: Date, index: true },
    source: { type: String, enum: ['purchase', 'admin_grant', 'promo'], default: 'purchase' },
  },
  { timestamps: true }
);

// Helper — is this subscription currently entitling the user to premium content.
subscriptionSchema.methods.isCurrentlyActive = function isCurrentlyActive() {
  return this.status === 'active' && this.expiryDate && this.expiryDate.getTime() > Date.now();
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
