const catchAsync = require('../../utils/catchAsync');
const authService = require('./auth.service');

const requestOtp = catchAsync(async (req, res) => {
  const result = await authService.requestOtp(req.body.phone);
  res.status(200).json({ success: true, data: result });
});

const verifyOtp = catchAsync(async (req, res) => {
  const { phone, code, name } = req.body;
  const { user, tokens, isNewUser } = await authService.verifyOtpAndLogin(phone, code, name);
  res.status(200).json({
    success: true,
    data: {
      user: { id: user._id, name: user.name, phone: user.phone, role: user.role },
      ...tokens,
      isNewUser,
    },
  });
});

const requestEmailOtp = catchAsync(async (req, res) => {
  const result = await authService.requestEmailOtp(req.body.email);
  res.status(200).json({ success: true, data: result });
});

const verifyEmailOtp = catchAsync(async (req, res) => {
  const { email, code, name } = req.body;
  const { user, tokens, isNewUser } = await authService.verifyEmailOtpAndLogin(email, code, name);
  res.status(200).json({
    success: true,
    data: {
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      ...tokens,
      isNewUser,
    },
  });
});

const googleAuth = catchAsync(async (req, res) => {
  const { idToken } = req.body;
  const { user, tokens, isNewUser } = await authService.loginWithGoogle(idToken);
  res.status(200).json({
    success: true,
    data: {
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      ...tokens,
      isNewUser,
    },
  });
});

const refresh = catchAsync(async (req, res) => {
  const tokens = await authService.refreshTokens(req.body.refreshToken);
  res.status(200).json({ success: true, data: tokens });
});

const logout = catchAsync(async (req, res) => {
  // Stateless JWT — client discards tokens. If a token blocklist is needed later,
  // add the token's jti to a Redis set with TTL = remaining expiry here.
  res.status(200).json({ success: true, message: 'Logged out' });
});

module.exports = { requestOtp, verifyOtp, requestEmailOtp, verifyEmailOtp, googleAuth, refresh, logout };
