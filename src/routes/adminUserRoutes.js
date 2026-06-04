import { Router } from 'express';
import {
  listUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getUserStats,
} from '../controllers/adminUserController.js';
import { protect, restrictTo } from '../middleware/protect.js';
import { adminCreateUserRules, adminUpdateUserRules } from '../middleware/validators.js';
import validate from '../middleware/validate.js';
import { mongoIdParam } from '../middleware/validators.js';

const router = Router();

router.use(protect);
router.use(restrictTo('Admin', 'Staff'));

router.get('/stats',        getUserStats);
router.get('/',             listUsers);
router.post('/',            adminCreateUserRules, validate, createUser);
router.get('/:id',          mongoIdParam(),        getUser);
router.put('/:id',          mongoIdParam(),        adminUpdateUserRules, validate, updateUser);
router.delete('/:id',       mongoIdParam(),        deleteUser);
router.patch('/:id/status', mongoIdParam(),        toggleUserStatus);

export default router;
