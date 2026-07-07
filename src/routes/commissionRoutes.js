import { Router } from 'express';
import { getCommissionSettings, updateCommissionSettings } from '../controllers/commissionController.js';
import { protect, restrictTo } from '../middleware/protect.js';

const router = Router();

router.use(protect);
router.use(restrictTo('Admin', 'Staff'));

router.get('/', getCommissionSettings);
router.put('/', updateCommissionSettings);

export default router;
