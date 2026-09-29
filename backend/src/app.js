const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const pinoHttp = require('pino-http');

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { globalApiLimiter } = require('./middlewares/rateLimit');
const billingController = require('./modules/billing/billing.controller');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
  })
);
app.use(pinoHttp({ logger }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/health/email', (_req, res) => {
  const { resolveProvider } = require('./config/mailer');
  res.json({
    provider: resolveProvider(),
    configuredPreference: env.EMAIL_OTP_PROVIDER,
    brevoKeyPresent: Boolean(env.BREVO_API_KEY),
    brevoFrom: env.BREVO_FROM || null,
    smtpConfigured: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
    smtpFrom: env.SMTP_FROM || null,
    appUrl: env.APP_URL,
  });
});
app.get('/ready', (_req, res) => {
  const ready = require('mongoose').connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable' });
});
app.use('/api', globalApiLimiter);
// Authenticated responses and published catalog updates must not be cached by shared proxies.
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// IMPORTANT: the Razorpay webhook needs the raw request body to verify the HMAC signature,
// so it's mounted here with express.raw() BEFORE the JSON body parser below. Any other route
// hitting /api/v1/billing/webhook/razorpay would otherwise get a pre-parsed (and therefore
// signature-mismatched) body.
app.post(
  '/api/v1/billing/webhook/razorpay',
  express.raw({ type: 'application/json' }),
  billingController.webhook
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(mongoSanitize());

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
