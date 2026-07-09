import CancellationPolicy from '../models/CancellationPolicy.js';
import Booking from '../models/Booking.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

export const getCancellationPolicy = async (req, res) => {
  try {
    const policy = await CancellationPolicy.getSingleton();
    return sendSuccess(res, policy);
  } catch (err) {
    logger.error(`getCancellationPolicy: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const updateCancellationPolicy = async (req, res) => {
  try {
    const { ownerHoldingDays, periods } = req.body;
    const policy = await CancellationPolicy.getSingleton();

    if (ownerHoldingDays !== undefined) policy.ownerHoldingDays = ownerHoldingDays;
    if (periods !== undefined) policy.periods = periods;
    policy.updatedBy = req.user._id;

    await policy.save();
    return sendSuccess(res, policy, 'Cancellation policy updated');
  } catch (err) {
    logger.error(`updateCancellationPolicy: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const calculateRefund = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) return { refundAmount: 0, platformFee: 0, ownerFee: 0 };

    const now = new Date();
    const checkIn = new Date(booking.checkIn);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysBeforeCheckIn = Math.ceil((checkIn.getTime() - now.getTime()) / msPerDay);

    const policy = await CancellationPolicy.getSingleton();
    const period = policy.getApplicablePeriod(daysBeforeCheckIn);

    const totalAmount = booking.totalAmount || 0;
    const refundAmount = Math.round(totalAmount * period.guestRefundPct / 100);
    const platformFee = Math.round(totalAmount * period.platformFeePct / 100);
    const ownerFee = Math.round(totalAmount * period.ownerFeePct / 100);

    return {
      refundAmount,
      platformFee,
      ownerFee,
      daysBeforeCheckIn,
      period,
    };
  } catch (err) {
    logger.error(`calculateRefund: ${err.message}`);
    return { refundAmount: 0, platformFee: 0, ownerFee: 0, daysBeforeCheckIn: 0 };
  }
};
