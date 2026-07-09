import Booking from '../models/Booking.js';
import { generateAndProcessScheduled } from '../controllers/payoutController.js';
import logger from '../utils/logger.js';

const AUTO_COMPLETE_INTERVAL = 60 * 60 * 1000;
const PAYOUT_INTERVAL = 3 * 60 * 60 * 1000;

let autoCompleteTimer = null;
let payoutTimer = null;

export async function autoCompleteBookings() {
  try {
    const now = new Date();
    const result = await Booking.updateMany(
      { status: 'confirmed', checkOut: { $lte: now } },
      { $set: { status: 'completed' } }
    );
    if (result.modifiedCount > 0) {
      logger.info(`Auto-completed ${result.modifiedCount} booking(s)`);
    }
    return result.modifiedCount;
  } catch (err) {
    logger.error(`autoCompleteBookings: ${err.message}`);
    return 0;
  }
}

export async function autoGeneratePayouts() {
  try {
    const { default: CancellationPolicy } = await import('../models/CancellationPolicy.js');
    const policy = await CancellationPolicy.getSingleton();
    const holdingDays = policy.ownerHoldingDays || 14;

    const { default: Payout } = await import('../models/Payout.js');

    const completedBookings = await Booking.find({
      status: 'completed',
      $or: [
        { payoutGenerated: { $ne: true } },
        { payoutGenerated: { $exists: false } },
      ],
    }).populate('property').lean();

    const cancelledWithOwnerFee = await Booking.find({
      status: 'cancelled',
      ownerRefundFee: { $gt: 0 },
      $or: [
        { payoutGenerated: { $ne: true } },
        { payoutGenerated: { $exists: false } },
      ],
    }).populate('property').lean();

    const allBookings = [...completedBookings, ...cancelledWithOwnerFee];
    const now = new Date();
    let created = 0;

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

      await Payout.create({
        booking: booking._id,
        owner: booking.property?.owner || booking.user,
        property: booking.property?._id || booking.property,
        totalAmount: booking.totalAmount,
        commissionAmount,
        ownerAmount: ownerAmount > 0 ? ownerAmount : 0,
        status: scheduledDate <= now ? 'scheduled' : 'pending',
        scheduledDate,
      });

      await Booking.findByIdAndUpdate(booking._id, { $set: { payoutGenerated: true } });
      created++;
    }

    if (created > 0) logger.info(`Generated ${created} payout(s)`);
    return created;
  } catch (err) {
    logger.error(`autoGeneratePayouts: ${err.message}`);
    return 0;
  }
}

export function startScheduler() {
  if (autoCompleteTimer) clearInterval(autoCompleteTimer);
  if (payoutTimer) clearInterval(payoutTimer);

  autoCompleteBookings();
  autoGeneratePayouts();

  autoCompleteTimer = setInterval(autoCompleteBookings, AUTO_COMPLETE_INTERVAL);
  payoutTimer = setInterval(autoGeneratePayouts, PAYOUT_INTERVAL);

  logger.info('Scheduler started (auto-complete: 1h, payout gen: 3h)');
}

export function stopScheduler() {
  if (autoCompleteTimer) { clearInterval(autoCompleteTimer); autoCompleteTimer = null; }
  if (payoutTimer) { clearInterval(payoutTimer); payoutTimer = null; }
  logger.info('Scheduler stopped');
}
