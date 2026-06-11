import express from 'express';
import { getReviews, createReview } from '../controllers/reviewController.js';
import { protect } from '../middleware/protect.js';
import { mongoIdParam } from '../middleware/validators.js';

const router = express.Router();

router.route('/:propertyId').get(mongoIdParam('propertyId'), getReviews).post(protect, mongoIdParam('propertyId'), createReview);

export default router;
