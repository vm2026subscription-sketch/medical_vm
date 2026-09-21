const { OAuth2Client } = require('google-auth-library');
const User = require('../../models/User');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const otpProvider = require('./otpProvider');

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

function issueTokenPair(user) {
  if (!user.isActive) throw ApiError.forbidden('This account is inactive. Contact support.');
  const payload = { sub: user._id.toString(), role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

async function requestOtp(phone) {
  return otpProvider.sendOtp(phone);
}

async function requestEmailOtp(email) {
  return otpProvider.sendEmailOtp(email);
}

async function verifyOtpAndLogin(phone, code, name) {
  await otpProvider.verifyOtp(phone, code);

  let user = await User.findOne({ phone });
  let isNewUser = false;
  if (!user) {
    user = await User.create({ phone, name, isVerified: true, role: 'student' });
    isNewUser = true;
  } else if (!user.isVerified) {
    user.isVerified = true;
    if (name && !user.name) user.name = name;
    await user.save();
  }

  const tokens = issueTokenPair(user);
  return { user, tokens, isNewUser };
}

/**
 * verifyEmailOtpAndLogin — same pattern as verifyOtpAndLogin but keyed on email instead of
 * phone. Finds-or-creates a User by email; if a user already exists with that phone-based
 * account and later adds email OTP, this still works since email is a separate unique field.
 */
async function verifyEmailOtpAndLogin(email, code, name) {
  await otpProvider.verifyEmailOtp(email, code);

  let user = await User.findOne({ email });
  let isNewUser = false;
  if (!user) {
    user = await User.create({ email, name, isVerified: true, role: 'student' });
    isNewUser = true;
  } else if (!user.isVerified) {
    user.isVerified = true;
    if (name && !user.name) user.name = name;
    await user.save();
  }

  const tokens = issueTokenPair(user);
  return { user, tokens, isNewUser };
}

async function loginWithGoogle(idToken) {
  const ticket = await googleClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email) throw ApiError.badRequest('Google token did not include an email');

  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email: payload.email }] });
  let isNewUser = false;
  if (!user) {
    user = await User.create({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      isVerified: true,
      role: 'student',
    });
    isNewUser = true;
  } else if (!user.googleId) {
    user.googleId = payload.sub;
    await user.save();
  }

  const tokens = issueTokenPair(user);
  return { user, tokens, isNewUser };
}

async function refreshTokens(refreshToken) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (_err) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }
  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('User not found or inactive');
  return issueTokenPair(user);
}

module.exports = { requestOtp, verifyOtpAndLogin, requestEmailOtp, verifyEmailOtpAndLogin, loginWithGoogle, refreshTokens };
