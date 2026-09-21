const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const env = require('../config/env');

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof ApiError)) {
    // Mongoose validation error
    if (error.type === 'entity.parse.failed') {
      error = ApiError.badRequest('Invalid JSON request body');
    } else if (error.type === 'entity.too.large') {
      error = new ApiError(413, 'Request body is too large');
    } else if (error.name === 'MulterError') {
      error = ApiError.badRequest(error.code === 'LIMIT_FILE_SIZE' ? 'File is too large. CSV limit: 10 MB; image limit: 8 MB.' : error.message);
    } else if (error.name === 'CastError') {
      error = ApiError.badRequest('Invalid record ID or field value');
    } else if (error.name === 'ValidationError') {
      error = ApiError.badRequest('Validation failed', error.errors);
    } else if (error.code === 11000) {
      error = ApiError.conflict('Duplicate value violates a unique constraint', error.keyValue);
    } else {
      logger.error({ err: error }, 'Unhandled error');
      error = ApiError.internal(env.NODE_ENV === 'production' ? 'Internal server error' : error.message);
    }
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    details: error.details || undefined,
    stack: env.NODE_ENV === 'production' ? undefined : err.stack,
  });
}

module.exports = { notFoundHandler, errorHandler };
