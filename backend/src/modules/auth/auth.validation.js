const { z } = require('zod');

const phoneRegex = /^\+?[1-9]\d{9,14}$/;

const requestOtp = {
  body: z.object({
    phone: z.string().trim().regex(phoneRegex, 'Enter a valid phone number with country code').transform((v) => `+${v.replace(/^\+/, '')}`),
  }),
};

const verifyOtp = {
  body: z.object({
    phone: z.string().trim().regex(phoneRegex).transform((v) => `+${v.replace(/^\+/, '')}`),
    code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
    name: z.string().min(1).optional(), // used to set name on first-time signup
  }),
};

const requestEmailOtp = {
  body: z.object({
    email: z.string().trim().email('Enter a valid email address').toLowerCase(),
  }),
};

const verifyEmailOtp = {
  body: z.object({
    email: z.string().trim().email().toLowerCase(),
    code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
    name: z.string().min(1).optional(),
  }),
};

const googleAuth = {
  body: z.object({
    idToken: z.string().min(10),
  }),
};

const refresh = {
  body: z.object({
    refreshToken: z.string().min(10),
  }),
};

module.exports = { requestOtp, verifyOtp, requestEmailOtp, verifyEmailOtp, googleAuth, refresh };
