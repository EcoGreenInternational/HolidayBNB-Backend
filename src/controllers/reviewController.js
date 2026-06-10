import Review from '../models/Review.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

export const getReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const reviews = await Review.find({ property: propertyId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    const avg = reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : 0;
    return sendSuccess(res, { reviews, avg: parseFloat(avg), count: reviews.length });
  } catch (err) {
    logger.error(`getReviews: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const createReview = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { rating, emotion, text } = req.body;

    const existing = await Review.findOne({ property: propertyId, user: req.user._id });
    if (existing) {
      return sendError(res, 'You have already reviewed this property', 400);
    }

    const review = await Review.create({
      property: propertyId,
      user: req.user._id,
      rating,
      emotion,
      text,
    });

    const populated = await Review.findById(review._id)
      .populate('user', 'name email')
      .lean();

    return sendCreated(res, { review: populated }, 'Review submitted successfully');
  } catch (err) {
    logger.error(`createReview: ${err.message}`);
    return sendError(res, err.message);
  }
};
