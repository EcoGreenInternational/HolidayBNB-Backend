import Stripe from 'stripe';
import Payout from '../models/Payout.js';
import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import CancellationPolicy from '../models/CancellationPolicy.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const getPayouts = async (req, res) => {
  try {
    const { status, owner, property, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (owner) filter.owner = owner;
    if (property) filter.property = property;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [payouts, total] = await Promise.all([
      Payout.find(filter)
        .populate('booking', 'checkIn checkOut totalAmount invoiceNumber')
        .populate('owner', 'name email bankDetails')
        .populate('property', 'name city country')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Payout.countDocuments(filter),
    ]);

    return sendSuccess(res, { payouts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    logger.error(`getPayouts: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const generatePayouts = async (req, res) => {
  try {
    const policy = await CancellationPolicy.getSingleton();
    const holdingDays = policy.ownerHoldingDays || 14;

    const completedBookings = await Booking.find({
      status: 'completed',
      $or: [
        { payoutGenerated: { $ne: true } },
        { payoutGenerated: { $exists: false } },
      ],
    }).lean();

    const cancelledWithOwnerFee = await Booking.find({
      status: 'cancelled',
      ownerRefundFee: { $gt: 0 },
      $or: [
        { payoutGenerated: { $ne: true } },
        { payoutGenerated: { $exists: false } },
      ],
    }).lean();

    const allBookings = [...completedBookings, ...cancelledWithOwnerFee];
    let generated = 0;
    const now = new Date();

    for (const booking of allBookings) {
      const existing = await Payout.findOne({ booking: booking._id });
      if (existing) continue;

      let ownerAmount;
      let commissionAmount;
      let scheduledDate;

      if (booking.status === 'cancelled') {
        ownerAmount = booking.ownerRefundFee || 0;
        commissionAmount = booking.platformRefundFee || 0;
        scheduledDate = new Date();
      } else {
        const checkOut = new Date(booking.checkOut);
        const holdingEnd = new Date(checkOut);
        holdingEnd.setDate(holdingEnd.getDate() + holdingDays);
        scheduledDate = holdingEnd;
        commissionAmount = booking.commissionAmount || 0;
        ownerAmount = booking.totalAmount - commissionAmount;
      }

      const property = await Property.findById(booking.property).populate('owner', '_id name email').lean();
      const ownerId = property?.owner?._id || property?.owner || null;

      await Payout.create({
        booking: booking._id,
        owner: ownerId,
        property: booking.property,
        totalAmount: booking.totalAmount,
        commissionAmount,
        ownerAmount: ownerAmount > 0 ? ownerAmount : 0,
        status: scheduledDate <= now ? 'scheduled' : 'pending',
        scheduledDate,
      });

      await Booking.findByIdAndUpdate(booking._id, { $set: { payoutGenerated: true } });
      generated++;
    }

    return sendSuccess(res, { generated }, `${generated} payout(s) generated`);
  } catch (err) {
    logger.error(`generatePayouts: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const processPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { method = 'manual_bank', transactionId, notes } = req.body;

    const payout = await Payout.findById(id).populate('owner').populate('booking');
    if (!payout) return sendError(res, 'Payout not found', 404);
    if (payout.status === 'paid') return sendError(res, 'Payout already processed', 400);

    payout.status = 'processing';
    payout.method = method;
    payout.processedBy = req.user._id;
    if (notes) payout.notes = notes;

    let failed = false;
    let errorMsg = '';

    if (method === 'stripe_transfer' || method === 'stripe_connect') {
      try {
        const owner = payout.owner;
        if (!owner.bankDetails || !owner.bankDetails.accountNumber) {
          throw new Error('Owner has no bank details on file');
        }

        try {
          const transfer = await stripe.transfers.create({
            amount: Math.round(payout.ownerAmount * 100),
            currency: owner.bankDetails.currency?.toLowerCase() || 'usd',
            destination: process.env.STRIPE_PLATFORM_ACCOUNT || undefined,
            description: `Payout for booking ${payout.booking?._id || payout.booking}`,
            metadata: {
              payoutId: payout._id.toString(),
              bookingId: (payout.booking?._id || payout.booking).toString(),
              ownerId: owner._id.toString(),
            },
          });
          payout.transactionId = transfer.id;
          notes ? (payout.notes += ` | ${notes}`) : null;
        } catch (transferErr) {
          failed = true;
          errorMsg = `Stripe transfer failed: ${transferErr.message}`;
          logger.error(errorMsg);
        }
      } catch (stripeErr) {
        failed = true;
        errorMsg = `Stripe error: ${stripeErr.message}`;
        logger.error(errorMsg);
      }
    }

    if (failed) {
      payout.status = 'failed';
      payout.lastError = errorMsg;
      payout.retryCount = (payout.retryCount || 0) + 1;
      await payout.save();
      return sendError(res, errorMsg);
    }

    payout.status = 'paid';
    payout.processedDate = new Date();
    payout.transactionId = payout.transactionId || transactionId || '';
    await payout.save();

    return sendSuccess(res, { payout }, 'Payout processed successfully');
  } catch (err) {
    logger.error(`processPayout: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const retryPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const payout = await Payout.findById(id);
    if (!payout) return sendError(res, 'Payout not found', 404);
    if (payout.status !== 'failed') return sendError(res, 'Only failed payouts can be retried', 400);

    payout.status = 'scheduled';
    payout.lastError = '';
    payout.processedDate = null;
    payout.transactionId = '';
    await payout.save();

    return sendSuccess(res, { payout }, 'Payout queued for retry');
  } catch (err) {
    logger.error(`retryPayout: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const generateAndProcessScheduled = async () => {
  try {
    const now = new Date();
    const pending = await Payout.find({
      status: { $in: ['pending', 'scheduled'] },
      scheduledDate: { $lte: now },
    }).populate('owner').populate('booking');

    let processed = 0;
    let failed = 0;

    for (const payout of pending) {
      payout.status = 'processing';

      try {
        const owner = payout.owner;
        if (owner?.bankDetails?.accountNumber) {
          const transfer = await stripe.transfers.create({
            amount: Math.round(payout.ownerAmount * 100),
            currency: owner.bankDetails.currency?.toLowerCase() || 'usd',
            destination: process.env.STRIPE_PLATFORM_ACCOUNT || undefined,
            description: `Auto-payout booking ${payout.booking?._id}`,
            metadata: { payoutId: payout._id.toString() },
          });
          payout.transactionId = transfer.id;
          payout.status = 'paid';
          payout.processedDate = new Date();
          processed++;
        } else {
          payout.status = 'failed';
          payout.lastError = 'No bank details on file for owner';
          failed++;
        }
      } catch (err) {
        payout.status = 'failed';
        payout.lastError = err.message;
        payout.retryCount = (payout.retryCount || 0) + 1;
        failed++;
        logger.error(`Auto-payout failed: ${err.message}`);
      }

      await payout.save();
    }

    return { processed, failed, total: pending.length };
  } catch (err) {
    logger.error(`generateAndProcessScheduled: ${err.message}`);
    return { processed: 0, failed: 0, total: 0 };
  }
};

export const getPayoutStats = async (req, res) => {
  try {
    const [pending, scheduled, paid, failed] = await Promise.all([
      Payout.countDocuments({ status: 'pending' }),
      Payout.countDocuments({ status: 'scheduled' }),
      Payout.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$ownerAmount' }, count: { $sum: 1 } } },
      ]),
      Payout.countDocuments({ status: 'failed' }),
    ]);

    return sendSuccess(res, {
      pending,
      scheduled,
      totalPaid: paid[0]?.total || 0,
      paidCount: paid[0]?.count || 0,
      failed,
    });
  } catch (err) {
    logger.error(`getPayoutStats: ${err.message}`);
    return sendError(res, err.message);
  }
};
