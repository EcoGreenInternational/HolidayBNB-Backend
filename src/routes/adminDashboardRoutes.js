import { Router } from 'express';
import { getDashboardStats } from '../controllers/adminDashboardController.js';
import { protect, restrictTo } from '../middleware/protect.js';

const router = Router();

router.use(protect);
router.use(restrictTo('Admin', 'Staff', 'Owner', 'Property Owner'));

router.get('/', getDashboardStats);

export default router;
