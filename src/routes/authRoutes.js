import { Router } from 'express';
import {
  register,
  login,
  verifyOtp,
  refreshToken,
  logout,
  logoutAll,
  getMe,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/protect.js';
import validate from '../middleware/validate.js';
import { registerRules, loginRules, forgotPasswordRules, resetPasswordRules, verifyOtpRules } from '../middleware/validators.js';

const router = Router();

router.post('/register', registerRules, validate, register);
router.post('/login',    loginRules,    validate, login);
router.post('/verify-otp', verifyOtpRules, validate, verifyOtp);
router.post('/refresh',                           refreshToken);
router.post('/logout',                            logout);
router.post('/forgot-password', forgotPasswordRules, validate, forgotPassword);
router.post('/reset-password',  resetPasswordRules,  validate, resetPassword);


router.post('/logout-all', protect, logoutAll);
router.get('/me',          protect, getMe);

export default router;
