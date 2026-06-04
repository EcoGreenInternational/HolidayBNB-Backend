import { verifyAccessToken } from '../utils/jwt.js';
import { sendUnauthorized, sendForbidden } from '../utils/apiResponse.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

// ─── protect ─────────────────────────────────────────────────────────────────
// Verifies the Bearer access token on every protected route.
// Attaches req.user so downstream controllers can use it.

export const protect = async (req, res, next) => {
  try {
    // 1. Pull token from Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return sendUnauthorized(res, 'No access token provided');
    }
    const token = authHeader.split(' ')[1];

    // 2. Verify signature & expiry
    const decoded = verifyAccessToken(token);
    if (!decoded) return sendUnauthorized(res, 'Invalid or expired access token');

    // 3. Load user from DB — confirms they still exist & are active
    const user = await User.findById(decoded.sub).select('+passwordChangedAt');
    if (!user)          return sendUnauthorized(res, 'User no longer exists');
    if (!user.isActive) return sendUnauthorized(res, 'Account deactivated');

    // 4. Reject tokens issued before a password change
    if (user.tokenIssuedBeforePasswordChange(decoded.iat)) {
      return sendUnauthorized(res, 'Password changed recently — please log in again');
    }

    // 5. Attach user to request object
    req.user = user;
    next();
  } catch (err) {
    logger.error(`protect middleware: ${err.message}`);
    return sendUnauthorized(res, 'Authentication failed');
  }
};

// ─── restrictTo ──────────────────────────────────────────────────────────────
// Call AFTER protect().  Usage: restrictTo('Admin', 'Staff')

export const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return sendForbidden(res, `Access restricted to: ${roles.join(', ')}`);
  }
  next();
};
