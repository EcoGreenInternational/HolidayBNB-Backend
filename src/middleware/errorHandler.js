import { sendError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

// ─── Global error handler ─────────────────────────────────────────────────────
// Must be registered LAST in app.js — Express identifies it by the 4-parameter signature.

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.originalUrl} → ${err.message}`, { stack: err.stack });

  // Mongoose: duplicate key (e.g. email already registered)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, `${field} is already in use`, 409);
  }

  // Mongoose: schema validation failed
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field:   e.path,
      message: e.message,
    }));
    return sendError(res, 'Validation failed', 400, errors);
  }

  // Mongoose: invalid ObjectId format
  if (err.name === 'CastError') {
    return sendError(res, `Invalid value for field: ${err.path}`, 400);
  }

  // Multer: file too large
  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, `File exceeds the ${process.env.MAX_FILE_SIZE_MB || 5}MB limit`, 413);
  }

  // Custom app errors can set err.statusCode
  const statusCode = err.statusCode || 500;

  // Hide internal details from users in production
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message;

  return sendError(res, message, statusCode);
};

// ─── 404 handler ─────────────────────────────────────────────────────────────
// Registered just before the error handler for any unmatched routes.

export const notFound = (req, res) => {
  sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};
