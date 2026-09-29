const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const Challenge = require('../../models/OtpChallenge');
const ApiError = require('../../utils/ApiError');
const { sendMail, resolveProvider } = require('../../config/mailer');
const brand = require('../../config/brand');
const normalize = (value, channel) => channel === 'email' ? value.trim().toLowerCase() : '+' + value.trim().replace(/^\+/, '');
const EMAIL_PROVIDERS = ['smtp', 'brevo', 'resend'];
function assertProvider(provider, channel) {
  const allowed = channel === 'email' ? [...EMAIL_PROVIDERS, 'mock'] : ['msg91', 'twilio', 'mock'];
  if (!allowed.includes(provider)) throw new ApiError(503, 'Login delivery is not configured. Contact support.');
  const keys = { smtp: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'], resend: ['RESEND_API_KEY'], brevo: ['BREVO_API_KEY'], msg91: ['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID'], twilio: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SID'], mock: [] }[provider];
  if (keys.some((key) => !env[key])) throw new ApiError(503, 'Login delivery is not configured. Contact support.');
}
async function twilio(endpoint, values) {
  const res = await fetch('https://verify.twilio.com/v2/Services/' + encodeURIComponent(env.TWILIO_VERIFY_SID) + '/' + endpoint, {
    method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { Authorization: 'Basic ' + Buffer.from(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status === 404 ? 400 : 503, res.status === 404 ? 'OTP expired. Request a new code.' : 'SMS verification is temporarily unavailable. Please retry.');
  return data;
}
async function send(identifier, channel) {
  identifier = normalize(identifier, channel);
  const provider = channel === 'email' ? resolveProvider() : env.OTP_PROVIDER;
  assertProvider(provider, channel);
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = await bcrypt.hash(code, 10);
  const version = crypto.randomUUID();
  const now = new Date();
  let record;
  try {
    record = await Challenge.findOneAndUpdate({ identifier, channel, requestedAt: { $lte: new Date(now.getTime() - 60000) } }, {
      $set: { provider, version, codeHash, requestedAt: now, expiresAt: new Date(now.getTime() + 300000), attempts: 0, state: 'sending' }, $unset: { providerSid: '' },
    }, { upsert: true, new: true });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(429, 'Wait 60 seconds before requesting another code.');
    throw error;
  }
  const filter = { _id: record._id, version };
  try {
    let providerSid;
    if (EMAIL_PROVIDERS.includes(provider)) {
      const delivered = await sendMail({
      to: identifier,
      subject: `Your ${brand.fullName} login code`,
      text: `Your ${brand.fullName} verification code is ${code}. It expires in 5 minutes. Sign in at ${brand.siteUrl}.`,
      html: `
        <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
          <div style="padding-bottom:16px;border-bottom:3px solid #f58232;"><strong style="font-size:26px;color:#25355b;">${brand.name}</strong><div style="font-size:12px;color:#58627b;">by <img src="${brand.siteUrl}/brand/vidyarthi-mitra.png" alt="Vidyarthi Mitra" width="166" height="42" style="vertical-align:middle;background:#fff;" /></div></div>
          <h2 style="color:#25355b;">Your verification code</h2>
          <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px;">${code}</p>
          <p style="color:#54697A; font-size: 13px;">This code expires in 5 minutes. If you didn't request this, you can ignore this email.</p>
          <a href="${brand.siteUrl}" style="font-size:12px;color:#25355b;">${brand.siteUrl.replace(/^https?:\/\//, '')}</a>
        </div>
      `,
    });

      if (!delivered) throw new ApiError(503, 'Could not send the verification email. Please retry.');
    } else if (provider === 'msg91') {
      const query = new URLSearchParams({ otp_expiry: '5', template_id: env.MSG91_TEMPLATE_ID, mobile: identifier.slice(1), otp: code });
      const res = await fetch('https://control.msg91.com/api/v5/otp?' + query, { method: 'POST', headers: { authkey: env.MSG91_AUTH_KEY }, signal: AbortSignal.timeout(12000) });
      const data = await res.json();
      if (!res.ok || data.type !== 'success') throw new ApiError(503, 'Could not send SMS OTP. Please retry.');
    } else if (provider === 'twilio') {
      const data = await twilio('Verifications', { To: identifier, Channel: 'sms' });
      if (data.status !== 'pending' || !data.sid) throw new ApiError(503, 'Could not send SMS OTP. Please retry.');
      providerSid = data.sid;
    }
    await Challenge.updateOne(filter, { $set: { state: 'ready', ...(providerSid ? { providerSid } : {}) } });
    return provider === 'mock' ? { sent: true, devOnlyCode: code } : { sent: true };
  } catch (error) {
    await Challenge.updateOne(filter, { $set: { state: 'failed' } });
    logger.warn({ provider, channel }, 'OTP delivery failed');
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, 'Could not deliver the verification code. Please retry.');
  }
}
async function verify(identifier, code, channel) {
  identifier = normalize(identifier, channel);
  // The attempt is reserved atomically before comparison, including concurrent requests.
  const record = await Challenge.findOneAndUpdate({ identifier, channel, state: 'ready', expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } }, { new: true });
  if (!record) throw ApiError.badRequest('OTP expired, already used, or too many attempts. Request a new code.');
  assertProvider(record.provider, channel);
  let matches;
  if (record.provider === 'twilio') {
    const result = await twilio('VerificationCheck', { VerificationSid: record.providerSid, Code: code });
    matches = result.status === 'approved';
  } else matches = await bcrypt.compare(code, record.codeHash);
  if (!matches) throw ApiError.badRequest('Incorrect OTP.');
  const consumed = await Challenge.updateOne({ _id: record._id, version: record.version, state: 'ready', expiresAt: { $gt: new Date() } }, { $set: { state: 'consumed' } });
  if (!consumed.modifiedCount) throw ApiError.badRequest('OTP already used or replaced. Request a new code.');
  return true;
}
module.exports = { sendOtp: (phone) => send(phone, 'sms'), sendEmailOtp: (email) => send(email, 'email'), verifyOtp: (phone, code) => verify(phone, code, 'sms'), verifyEmailOtp: (email, code) => verify(email, code, 'email') };
