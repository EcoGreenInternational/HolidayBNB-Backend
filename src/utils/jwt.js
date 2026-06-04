import jwt from 'jsonwebtoken';
import logger from './logger.js';

const {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES  = '15m',
  JWT_REFRESH_EXPIRES = '7d',
} = process.env;

// ─── Sign tokens ──────────────────────────────────────────────────────────────

export const signAccessToken = (payload) =>
  jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES,
    issuer:    'hollybnb-api',
    audience:  'hollybnb-client',
  });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES,
    issuer:    'hollybnb-api',
    audience:  'hollybnb-client',
  });

// ─── Verify tokens ────────────────────────────────────────────────────────────

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET, {
      issuer:   'hollybnb-api',
      audience: 'hollybnb-client',
    });
  } catch (err) {
    logger.debug(`Access token verify failed: ${err.message}`);
    return null;
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer:   'hollybnb-api',
      audience: 'hollybnb-client',
    });
  } catch (err) {
    logger.debug(`Refresh token verify failed: ${err.message}`);
    return null;
  }
};

// ─── HTTP-only cookie helpers ─────────────────────────────────────────────────
// The refresh token lives in a cookie — JS on the frontend cannot read it.
// This protects against XSS stealing the refresh token.

const COOKIE_NAME = 'hollybnb_refresh';

export const setRefreshCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',   // HTTPS only in prod
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,                // 7 days in ms
    path:     '/api/auth',                             // cookie only sent to /api/auth/*
  });
};

export const clearRefreshCookie = (res) =>
  res.clearCookie(COOKIE_NAME, { path: '/api/auth' });

export const getRefreshCookie = (req) =>
  req.cookies?.[COOKIE_NAME] ?? null;

// ─── Convenience: build both tokens at once ───────────────────────────────────

export const issueTokenPair = (user) => {
  const payload = { sub: user._id.toString(), role: user.role };
  return {
    accessToken:  signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
};
