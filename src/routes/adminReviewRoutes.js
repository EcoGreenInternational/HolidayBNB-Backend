import express from 'express';
import { listReviews, approveReview, deleteReview } from '../controllers/adminReviewController.js';
import { protect, restrictTo } from '../middleware/protect.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('Admin', 'Staff', 'Owner', 'Property Owner'));

router.get('/', listReviews);
router.patch('/:id/status', approveReview);
router.delete('/:id', deleteReview);

export default router;
