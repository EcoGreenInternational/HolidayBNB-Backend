import User from '../models/User.js';
import {
  issueTokenPair,
  setRefreshCookie,
  clearRefreshCookie,
  getRefreshCookie,
  verifyRefreshToken,
} from '../utils/jwt.js';
import {
  sendSuccess,
  sendCreated,
  sendError,
  sendUnauthorized,
  sendConflict,
} from '../utils/apiResponse.js';
import logger from '../utils/logger.js';
import { sendOTP } from '../utils/mailer.js';


export const register = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    
    const existing = await User.findOne({ $or: [{ email }, { username }] }).lean();
    if (existing) {
      const field = existing.email === email ? 'Email' : 'Username';
      return sendConflict(res, `${field} is already registered`);
    }

    const user = await User.create({ name, username, email, password });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    await User.updateOne(
      { _id: user._id },
      { $set: { otpCode: otp, otpExpires: Date.now() + 5 * 60 * 1000 } }
    );

    // Send email (fail gracefully if mailer fails but still return error)
    await sendOTP(user.email, otp);

    logger.info(`OTP generated for new user: ${user.email}`);

    return sendSuccess(res, { otpRequired: true, email: user.email }, 'OTP sent to email. Please verify to complete registration.');

  } catch (err) {
    logger.error(`register: ${err.message}`);
    return sendError(res, err.message);
  }
};


export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() },
      ],
    }).select('+password +refreshTokens +loginAttempts +lockUntil');

    
    if (user?.isLocked) {
      return sendUnauthorized(res, 'Account locked due to too many failed attempts. Try again in 2 hours');
    }

    
    if (!user || !(await user.comparePassword(password))) {
      if (user) await user.incrementLoginAttempts();
      return sendUnauthorized(res, 'Invalid credentials');
    }


    if (!user.isActive) {
      return sendUnauthorized(res, 'This account has been deactivated');
    }

    // All good — reset lockout counter
    await user.resetLoginAttempts();

    const { accessToken, refreshToken } = issueTokenPair(user);
    await user.addRefreshToken(refreshToken);
    setRefreshCookie(res, refreshToken);

    logger.info(`User logged in: ${user.email}`);

    return sendSuccess(res, { accessToken, user: user.toSafeObject() }, 'Login successful');

  } catch (err) {
    logger.error(`login: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email) return sendError(res, 'Email is missing');

    const user = await User.findOne({ email: email.toLowerCase() }).select('+otpCode +otpExpires +refreshTokens');
    
    if (!user) return sendUnauthorized(res, 'User not found');
    if (!user.otpCode || user.otpCode !== otp) return sendUnauthorized(res, 'Invalid OTP');
    if (user.otpExpires < Date.now()) return sendUnauthorized(res, 'OTP expired');
    // Clear OTP and mark email as verified
    await User.updateOne(
      { _id: user._id },
      { 
        $unset: { otpCode: 1, otpExpires: 1 },
        $set: { isEmailVerified: true }
      }
    );

    const { accessToken, refreshToken } = issueTokenPair(user);
    await user.addRefreshToken(refreshToken);
    setRefreshCookie(res, refreshToken);

    logger.info(`User logged in via OTP: ${user.email}`);

    return sendSuccess(res, { accessToken, user: user.toSafeObject() }, 'Login successful');
  } catch (err) {
    logger.error(`verifyOtp: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const refreshToken = async (req, res) => {
  try {
    const token = getRefreshCookie(req);
    if (!token) return sendUnauthorized(res, 'No refresh token');

    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      clearRefreshCookie(res);
      return sendUnauthorized(res, 'Invalid or expired refresh token');
    }

    const user = await User.findById(decoded.sub).select('+refreshTokens');
    if (!user || !user.refreshTokens.includes(token)) {
      if (user) {
        await user.removeAllRefreshTokens();
        logger.warn(`Possible token reuse for user: ${user.email} — all sessions revoked`);
      }
      clearRefreshCookie(res);
      return sendUnauthorized(res, 'Token reuse detected. Please log in again');
    }
    await user.removeRefreshToken(token);
    const { accessToken, refreshToken: newRefresh } = issueTokenPair(user);
    await user.addRefreshToken(newRefresh);
    setRefreshCookie(res, newRefresh);

    return sendSuccess(res, { accessToken }, 'Token refreshed');

  } catch (err) {
    logger.error(`refreshToken: ${err.message}`);
    return sendError(res, err.message);
  }
};
export const logout = async (req, res) => {
  try {
    const token = getRefreshCookie(req);
    clearRefreshCookie(res);

    if (token) {
      const decoded = verifyRefreshToken(token);
      if (decoded) {
        const user = await User.findById(decoded.sub).select('+refreshTokens');
        if (user) await user.removeRefreshToken(token);
      }
    }

    return sendSuccess(res, {}, 'Logged out');
  } catch (err) {
    logger.error(`logout: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const logoutAll = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+refreshTokens');
    await user.removeAllRefreshTokens();
    clearRefreshCookie(res);

    logger.info(`All sessions revoked: ${user.email}`);
    return sendSuccess(res, {}, 'Logged out from all devices');
  } catch (err) {
    logger.error(`logoutAll: ${err.message}`);
    return sendError(res, err.message);
  }
};


export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    return sendSuccess(res, { user: user.toSafeObject() });
  } catch (err) {
    logger.error(`getMe: ${err.message}`);
    return sendError(res, err.message);
  }
};
