import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  updateAvatar,
  addExperience,
  removeExperience,
  getAllUsers,
  getUserById,
  updateUserRole,
  toggleUserStatus,
} from '../controllers/userController.js';
import { protect, restrictTo } from '../middleware/protect.js';
import validate from '../middleware/validate.js';
import { updateProfileRules, mongoIdParam } from '../middleware/validators.js';
import { uploadAvatar } from '../middleware/upload.js';

const router = Router();


router.use(protect);

router.get   ('/profile',                          getProfile);
router.patch ('/profile', updateProfileRules, validate, updateProfile);
router.patch ('/avatar',  uploadAvatar,        updateAvatar);

// ── Travel experiences ────────────────────────────────────────────────────────
router.post  ('/experiences',           addExperience);
router.delete('/experiences/:expId',    removeExperience);

// ── Admin-only routes ─────────────────────────────────────────────────────────
router.get   ('/',                    restrictTo('Admin'),          getAllUsers);
router.get   ('/:id', mongoIdParam(), restrictTo('Admin'),          getUserById);
router.patch ('/:id/role',            restrictTo('Admin'),          updateUserRole);
router.patch ('/:id/status',          restrictTo('Admin'),          toggleUserStatus);

export default router;
