import Review from '../models/Review.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

export const getReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const reviews = await Review.find({ property: propertyId })
      .populate('user', 'name')
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

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayCount = await Review.countDocuments({
      property: propertyId,
      user: req.user._id,
      createdAt: { $gte: startOfDay },
    });
    if (todayCount >= 5) {
      return sendError(res, 'You can only submit up to 5 reviews per day for this property', 429);
    }

    const review = await Review.create({
      property: propertyId,
      user: req.user._id,
      rating,
      emotion,
      text,
    });

    const populated = await Review.findById(review._id)
      .populate('user', 'name')
      .lean();

    return sendCreated(res, { review: populated }, 'Review submitted successfully');
  } catch (err) {
    logger.error(`createReview: ${err.message}`);
    return sendError(res, err.message);
  }
};
