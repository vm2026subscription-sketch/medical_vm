const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');

/**
 * requireAuth — verifies the Bearer access token and attaches req.user = { id, role }.
 * Throws 401 if missing/invalid/expired.
 */
function requireAuth() {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) {
        throw ApiError.unauthorized('Missing or malformed Authorization header');
      }
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.sub).select('_id role isActive');
      if (!user || !user.isActive) {
        throw ApiError.unauthorized('User not found or inactive');
      }
      req.user = { id: user._id.toString(), role: user.role };
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') return next(ApiError.unauthorized('Access token expired'));
      if (err.name === 'JsonWebTokenError') return next(ApiError.unauthorized('Invalid access token'));
      next(err);
    }
  };
}

/**
 * optionalAuth — same as requireAuth but does not throw if no token is present.
 * Useful for routes like /cutoffs where guests get a free-tier response and logged-in
 * premium users get the full response.
 */
function optionalAuth() {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const [scheme, token] = header.split(' ');
      if (scheme === 'Bearer' && token) {
        const decoded = verifyAccessToken(token);
        const user = await User.findById(decoded.sub).select('_id role isActive');
        if (user && user.isActive) {
          req.user = { id: user._id.toString(), role: user.role };
        }
      }
      next();
    } catch (_err) {
      // Invalid/expired token on an optional route just means "treat as guest"
      next();
    }
  };
}

module.exports = { requireAuth, optionalAuth };
