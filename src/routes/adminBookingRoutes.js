import { Router } from 'express';
import { getAllBookings } from '../controllers/bookingController.js';
import { protect, restrictTo } from '../middleware/protect.js';

const router = Router();

router.use(protect);
router.use(restrictTo('Admin', 'Staff', 'Owner', 'Property Owner'));

router.get('/', getAllBookings);

export default router;
