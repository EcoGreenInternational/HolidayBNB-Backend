import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// ── Dev format: readable colored lines ──────────────────────────────────────
const devFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});


const prodFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  return JSON.stringify({ timestamp, level, message: stack || message, ...meta });
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true })),
  transports: [
    // Always log to console
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? prodFormat
          : combine(colorize(), timestamp({ format: 'HH:mm:ss' }), devFormat),
    }),
    // Error-only log file
    new winston.transports.File({ filename: 'logs/error.log', level: 'error', format: prodFormat }),
    // Combined log file (all levels)
    new winston.transports.File({ filename: 'logs/combined.log', format: prodFormat }),
  ],
  // Catch uncaught exceptions & unhandled rejections
  exceptionHandlers: [new winston.transports.File({ filename: 'logs/exceptions.log' })],
  rejectionHandlers: [new winston.transports.File({ filename: 'logs/rejections.log' })],
});

export default logger;
