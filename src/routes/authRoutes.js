import { Router } from 'express';
import {
  register,
  login,
  verifyOtp,
  refreshToken,
  logout,
  logoutAll,
  getMe,
} from '../controllers/authController.js';
import { protect } from '../middleware/protect.js';
import validate from '../middleware/validate.js';
import { registerRules, loginRules } from '../middleware/validators.js';

const router = Router();

router.post('/register', registerRules, validate, register);
router.post('/login',    loginRules,    validate, login);
router.post('/verify-otp', verifyOtp);
router.post('/refresh',                           refreshToken);
router.post('/logout',                            logout);


router.post('/logout-all', protect, logoutAll);
router.get('/me',          protect, getMe);

export default router;
