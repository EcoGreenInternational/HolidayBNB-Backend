import Booking from '../models/Booking.js';
import Payout from '../models/Payout.js';
import Property from '../models/Property.js';
import Review from '../models/Review.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

export const getDashboardStats = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'Owner' || req.user.role === 'Property Owner') {
      const props = await Property.find({ owner: req.user._id }).select('_id').lean();
      filter.property = { $in: props.map(p => p._id) };
    }

    const [
      totalBookings,
      confirmedBookings,
      pendingBookings,
      cancelledBookings,
      revenueResult,
      totalProperties,
      recentBookings,
    ] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.countDocuments({ ...filter, status: 'confirmed' }),
      Booking.countDocuments({ ...filter, status: 'pending' }),
      Booking.countDocuments({ ...filter, status: 'cancelled' }),
      Booking.aggregate([
        { $match: { ...filter, status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Property.countDocuments(filter.property ? { _id: { $in: filter.property.$in } } : {}),
      Booking.find(filter)
        .populate('property', 'name')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    const commissionResult = await Booking.aggregate([
      { $match: { ...filter, status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);
    const commissionEarned = commissionResult.length > 0 ? commissionResult[0].total : 0;

    const monthlyRevenue = await Booking.aggregate([
      {
        $match: {
          ...filter,
          status: 'confirmed',
          paidAt: { $gte: new Date(new Date().getFullYear(), 0, 1) },
        },
      },
      {
        $group: {
          _id: { $month: '$paidAt' },
          total: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthly = Array(12).fill(0);
    monthlyRevenue.forEach(m => { monthly[m._id - 1] = m.total; });

    const topStaysAgg = await Booking.aggregate([
      { $match: { ...filter, status: 'confirmed' } },
      { $group: { _id: '$property', bookings: { $sum: 1 } } },
      { $sort: { bookings: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'properties',
          localField: '_id',
          foreignField: '_id',
          as: 'property',
        },
      },
      { $unwind: '$property' },
      { $project: { name: '$property.name', bookings: 1 } },
    ]);

    const maxBookings = topStaysAgg.length > 0 ? Math.max(...topStaysAgg.map(s => s.bookings)) : 1;

    const topStays = topStaysAgg.map(s => ({
      name: s.name,
      bookings: s.bookings,
      pct: Math.round((s.bookings / maxBookings) * 100),
    }));

    const totalGuestsAgg = await Booking.aggregate([
      { $match: { ...filter, status: 'confirmed' } },
      {
        $group: {
          _id: null,
          total: { $sum: { $add: ['$guests.adults', '$guests.children'] } },
        },
      },
    ]);
    const totalGuests = totalGuestsAgg.length > 0 ? totalGuestsAgg[0].total : 0;

    const reviewFilter = filter.property ? { property: filter.property } : {};

    const [pendingPayouts, failedRefunds, totalReviews, approvedReviews, pendingProperties, reviewStats] = await Promise.all([
      Payout.countDocuments({ status: { $in: ['pending', 'scheduled'] } }),
      Booking.countDocuments({ refundStatus: 'failed' }),
      Review.countDocuments(reviewFilter),
      Review.countDocuments({ ...reviewFilter, status: 'approved' }),
      Property.countDocuments(filter.property ? { _id: { $in: filter.property.$in }, status: 'Pending' } : { status: 'Pending' }),
      Review.aggregate([
        { $match: reviewFilter },
        { $group: { _id: null, avg: { $avg: '$rating' } } },
      ]),
    ]);

    const reviewAvg = reviewStats.length > 0 ? Math.round(reviewStats[0].avg * 10) / 10 : 0;

    const recentReviews = await Review.find(reviewFilter)
      .populate('user', 'name')
      .populate('property', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return sendSuccess(res, {
      stats: {
        totalRevenue,
        commissionEarned,
        confirmedBookings,
        totalBookings,
        totalGuests,
        totalProperties,
        pendingBookings,
        cancelledBookings,
        totalReviews,
        approvedReviews,
        reviewAvg,
        pendingPayouts,
        failedRefunds,
        pendingProperties,
      },
      monthly,
      recentBookings,
      topStays,
      recentReviews,
    });
  } catch (err) {
    logger.error(`getDashboardStats: ${err.message}`);
    return sendError(res, err.message);
  }
};
