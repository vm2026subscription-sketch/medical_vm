const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');
const logger = require('./utils/logger');
const brand = require('./config/brand');
const { resolveProvider } = require('./config/mailer');

async function main() {
  await connectDB();

  logger.info(
    {
      emailProvider: resolveProvider(),
      configuredPreference: env.EMAIL_OTP_PROVIDER,
      brevoKey: Boolean(env.BREVO_API_KEY),
      resendKey: Boolean(env.RESEND_API_KEY),
      smtpConfigured: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
    },
    'Email OTP provider resolved'
  );

  const server = app.listen(env.PORT, () => {
    logger.info(`${brand.fullName} API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  let shuttingDown = false;
  const shutdown = (signal, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      try {
        await require('./jobs/queues').closeQueues();
        await require('./config/redis').closeRedisConnection();
        await require('mongoose').disconnect();
        logger.info('HTTP server and database connections closed');
        process.exit(exitCode);
      } catch (err) { logger.error({ err }, 'Shutdown failed'); process.exit(1); }
    });
    // Force exit if not closed within 10s
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
    shutdown('unhandledRejection', 1);
  });
  process.on('uncaughtException', (err) => { logger.fatal({ err }, 'Uncaught exception'); shutdown('uncaughtException', 1); });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during startup', err);
  process.exit(1);
});
