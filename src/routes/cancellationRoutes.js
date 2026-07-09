import { Router } from 'express';
import { getCancellationPolicy, updateCancellationPolicy } from '../controllers/cancellationController.js';
import { protect, restrictTo } from '../middleware/protect.js';

const router = Router();

router.use(protect);
router.use(restrictTo('Admin', 'Staff'));

router.get('/', getCancellationPolicy);
router.put('/', updateCancellationPolicy);

export default router;
