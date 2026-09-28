const dotenv = require('dotenv');
const dns = require('node:dns');
dotenv.config();

// Apply before clients start DNS queries. Leave blank to use the system resolver.
// Useful when Node's resolver cannot resolve MongoDB Atlas SRV/TXT records.
const dnsServers = (process.env.DNS_SERVERS || '').split(',').map((server) => server.trim()).filter(Boolean);
if (dnsServers.length) dns.setServers(dnsServers);

// Hosts like smtp.gmail.com publish AAAA records, but Railway has no IPv6 route, so the
// IPv6 attempt fails with ENETUNREACH before the IPv4 connection is ever tried.
dns.setDefaultResultOrder('ipv4first');

if (process.env.NODE_ENV === 'production') {
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if (!process.env[key] || process.env[key].length < 32 || /change.me|dev-.*secret/i.test(process.env[key])) {
      throw new Error(`${key} must be a strong secret of at least 32 characters in production`);
    }
  }
  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) throw new Error('Use different access and refresh token secrets');
}

function required(name, fallback) {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    // eslint-disable-next-line no-console
    console.warn(`[env] Missing env var ${name}. Set it in .env for production.`);
  }
  return val;
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  TRUST_PROXY: process.env.TRUST_PROXY === '1' ? 1 : process.env.TRUST_PROXY ? process.env.TRUST_PROXY.split(',').map((value) => value.trim()) : false,

  MONGODB_URI: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/medpath'),

  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL || '15m',
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL || '30d',

  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',

  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',

  OTP_PROVIDER: process.env.OTP_PROVIDER || 'mock', // 'mock' | 'msg91' | 'twilio'
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY || '',
  MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID || '',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_VERIFY_SID: process.env.TWILIO_VERIFY_SID || '',

  // Email OTP — 'mock' logs the code instead of sending mail, 'smtp' sends via SMTP_*,
  // 'resend'/'brevo' use their HTTP APIs (port 443 — required on hosts that block
  // outbound SMTP, e.g. Railway times out on port 587).
  EMAIL_OTP_PROVIDER: process.env.EMAIL_OTP_PROVIDER || 'mock', // 'mock' | 'smtp' | 'resend' | 'brevo'
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '',

  // HTTP mail providers (recommended for production hosting)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RESEND_FROM: process.env.RESEND_FROM || '',
  BREVO_API_KEY: process.env.BREVO_API_KEY || '',
  BREVO_FROM: process.env.BREVO_FROM || '',
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME || '',

  // Cloudinary — for college images / avatars uploaded from the admin panel
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'https://medical.vidyarthimitra.org,http://localhost:5173,http://localhost:3000,http://localhost:8080')
    .split(',').map((origin) => origin.trim()).filter(Boolean),

  SLOT_HOLD_MINUTES: parseInt(process.env.SLOT_HOLD_MINUTES || '5', 10),
  FREE_CUTOFF_ROWS: parseInt(process.env.FREE_CUTOFF_ROWS || '5', 10),
};
