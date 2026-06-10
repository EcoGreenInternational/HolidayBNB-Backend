import express from 'express';
import { getReviews, createReview } from '../controllers/reviewController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/:propertyId').get(getReviews).post(protect, createReview);

export default router;
