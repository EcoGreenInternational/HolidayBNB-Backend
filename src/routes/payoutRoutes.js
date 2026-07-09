import { Router } from 'express';
import {
  getPayouts, generatePayouts, processPayout, retryPayout, getPayoutStats,
} from '../controllers/payoutController.js';
import { protect, restrictTo } from '../middleware/protect.js';

const router = Router();

router.use(protect);
router.use(restrictTo('Admin', 'Staff'));

router.get('/', getPayouts);
router.post('/generate', generatePayouts);
router.get('/stats', getPayoutStats);
router.put('/:id/process', processPayout);
router.post('/:id/retry', retryPayout);

export default router;
