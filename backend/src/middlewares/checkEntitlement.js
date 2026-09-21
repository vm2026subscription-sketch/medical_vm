const Subscription = require('../models/Subscription');

/**
 * attachEntitlement — sets req.isPremium = true|false based on whether the current user
 * (if any) has an active subscription. Never trust a client-supplied "isPremium" flag —
 * this is the single source of truth reused across cutoffs, predictor, and PDF export.
 *
 * Safe to use after optionalAuth() (guests are simply isPremium = false).
 */
function attachEntitlement() {
  return async (req, res, next) => {
    try {
      req.isPremium = false;
      if (req.user) {
        const activeSub = await Subscription.findOne({
          userId: req.user.id,
          status: 'active',
          expiryDate: { $gt: new Date() },
        }).sort({ expiryDate: -1 });
        req.isPremium = !!activeSub;
        req.activeSubscription = activeSub || null;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { attachEntitlement };
