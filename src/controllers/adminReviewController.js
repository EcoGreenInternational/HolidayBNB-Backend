import Review from '../models/Review.js';
import Property from '../models/Property.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

export const listReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, property } = req.query;
    const filter = {};

    if (status && ['pending', 'approved'].includes(status)) {
      filter.status = status;
    }

    if (property) {
      filter.property = property;
    }

    if (search) {
      filter.$or = [
        { text: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('user', 'name email')
        .populate('property', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Review.countDocuments(filter),
    ]);

    const allReviews = await Review.find({}).lean();
    const totalApproved = allReviews.filter(r => r.status === 'approved').length;
    const totalPending = allReviews.filter(r => r.status === 'pending').length;
    const avgRating = allReviews.length
      ? (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1)
      : 0;
    const ratingCount = allReviews.length;

    return sendSuccess(res, {
      reviews,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      stats: { totalReviews: allReviews.length, approved: totalApproved, pending: totalPending, avgRating: parseFloat(avgRating), ratingCount },
    });
  } catch (err) {
    logger.error(`listReviews: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const approveReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['approved', 'pending'];
    if (!allowed.includes(status)) {
      return sendError(res, 'Status must be "approved" or "pending"', 400);
    }

    const review = await Review.findByIdAndUpdate(id, { status }, { new: true })
      .populate('user', 'name email')
      .populate('property', 'name')
      .lean();

    if (!review) {
      return sendNotFound(res, 'Review not found');
    }

    return sendSuccess(res, { review });
  } catch (err) {
    logger.error(`approveReview: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findByIdAndDelete(id).lean();

    if (!review) {
      return sendNotFound(res, 'Review not found');
    }

    return sendSuccess(res, { message: 'Review deleted successfully' });
  } catch (err) {
    logger.error(`deleteReview: ${err.message}`);
    return sendError(res, err.message);
  }
};
