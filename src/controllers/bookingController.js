import Stripe from 'stripe';
import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import { getApplicableRate } from './commissionController.js';
import { calculateRefund } from './cancellationController.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/apiResponse.js';
import { generateInvoice } from '../utils/invoice.js';
import logger from '../utils/logger.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const GAP_HOURS = 1;

const parseDate = (d) => {
  const date = new Date(d);
  date.setHours(15, 0, 0, 0);
  return date;
};

const parseCheckOut = (d) => {
  const date = new Date(d);
  date.setHours(11, 0, 0, 0);
  return date;
};

function nightsBetween(start, end) {
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

export const checkAvailability = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { checkIn, checkOut } = req.query;

    if (!checkIn || !checkOut) {
      return sendError(res, 'checkIn and checkOut are required', 400);
    }

    const inDate = parseDate(checkIn);
    const outDate = parseCheckOut(checkOut);

    if (outDate <= inDate) {
      return sendError(res, 'Check-out must be after check-in', 400);
    }

    const property = await Property.findById(propertyId).lean();
    if (!property) return sendNotFound(res, 'Property not found');

    const gap = GAP_HOURS * 60 * 60 * 1000;
    const effectiveIn = new Date(inDate.getTime() - gap);
    const effectiveOut = new Date(outDate.getTime() + gap);

    const conflicting = await Booking.findOne({
      property: propertyId,
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        { checkIn: { $lt: effectiveOut }, checkOut: { $gt: effectiveIn } },
      ],
    }).lean();

    const available = !conflicting;

    const blockedDates = await Booking.find({
      property: propertyId,
      status: { $in: ['pending', 'confirmed'] },
      checkOut: { $gt: new Date() },
    })
      .select('checkIn checkOut')
      .lean();

    const unavailableRanges = blockedDates.map(b => ({
      start: b.checkIn,
      end: new Date(b.checkOut.getTime() + gap),
    }));

    return sendSuccess(res, {
      available,
      property: { price: property.price, cleaningFee: property.cleaningFee, maxAdults: property.maxAdults, maxChildren: property.maxChildren, minNights: property.minNights || 1 },
      unavailableRanges,
    });
  } catch (err) {
    logger.error(`checkAvailability: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const createCheckoutSession = async (req, res) => {
  try {
    const { propertyId, checkIn, checkOut, guests } = req.body;

    const inDate = parseDate(checkIn);
    const outDate = parseCheckOut(checkOut);

    if (outDate <= inDate) {
      return sendError(res, 'Check-out must be after check-in', 400);
    }

    const nights = nightsBetween(inDate, outDate);
    if (nights < 1) {
      return sendError(res, 'Minimum stay is 1 night', 400);
    }

    const property = await Property.findById(propertyId).lean();
    if (!property) return sendNotFound(res, 'Property not found');

    const minNights = property.minNights || 1;
    if (nights < minNights) {
      return sendError(res, `Minimum stay is ${minNights} night(s)`, 400);
    }

    const totalAdults = guests?.adults || 1;
    const totalChildren = guests?.children || 0;
    if (totalAdults > (property.maxAdults || 99)) {
      return sendError(res, `Maximum ${property.maxAdults} adult(s) allowed`, 400);
    }
    if (totalChildren > (property.maxChildren || 99)) {
      return sendError(res, `Maximum ${property.maxChildren} children allowed`, 400);
    }

    const gap = GAP_HOURS * 60 * 60 * 1000;
    const effectiveIn = new Date(inDate.getTime() - gap);
    const effectiveOut = new Date(outDate.getTime() + gap);

    const conflicting = await Booking.findOne({
      property: propertyId,
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        { checkIn: { $lt: effectiveOut }, checkOut: { $gt: effectiveIn } },
      ],
    }).lean();

    if (conflicting) {
      return sendError(res, 'This property is not available for the selected dates', 409);
    }

    const nightlyRate = parseFloat(property.price) || 0;
    const subtotal = nightlyRate * nights;
    const cleaningFee = parseFloat(property.cleaningFee) || 0;
    const serviceFee = Math.round((subtotal + cleaningFee) * 0.12);
    const totalAmount = subtotal + cleaningFee + serviceFee;

    const commissionRate = await getApplicableRate(property.propertyType);
    const commissionAmount = Math.round(totalAmount * (commissionRate / 100));

    const booking = await Booking.create({
      property: propertyId,
      user: req.user._id,
      checkIn: inDate,
      checkOut: outDate,
      guests: { adults: totalAdults, children: totalChildren },
      totalAmount,
      serviceFee,
      commissionRate,
      commissionAmount,
    });

    const frontendUrl = req.body.clientUrl || process.env.CLIENT_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: req.user.email,
      client_reference_id: booking._id.toString(),
      metadata: {
        bookingId: booking._id.toString(),
        propertyId,
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: property.name || 'Property Stay',
              description: `${nights} night(s) · ${inDate.toLocaleDateString()} - ${outDate.toLocaleDateString()}`,
              images: property.images?.length ? [property.images[0]?.url || property.images[0]] : [],
            },
            unit_amount: Math.round(nightlyRate * 100),
          },
          quantity: nights,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Cleaning Fee' },
            unit_amount: Math.round(cleaningFee * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Service Fee' },
            unit_amount: Math.round(serviceFee * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/booking/confirmation?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking._id}`,
      cancel_url: `${frontendUrl}/property/${propertyId}?cancelled=true`,
    });

    booking.stripeSessionId = session.id;
    await booking.save();

    return sendCreated(res, { url: session.url, sessionId: session.id, bookingId: booking._id });
  } catch (err) {
    logger.error(`createCheckoutSession: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    const payload = req.rawBody || req.body;
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error(`Stripe webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;

    if (bookingId) {
      try {
        const booking = await Booking.findById(bookingId).populate('property').populate('user', 'name email');
        if (booking && booking.status === 'pending') {
          const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          booking.status = 'confirmed';
          booking.invoiceNumber = invoiceNumber;
          booking.paidAt = new Date();
          await booking.save();

          try {
            await generateInvoice(booking);
          } catch (invErr) {
            logger.error(`Invoice generation failed: ${invErr.message}`);
          }
        }
      } catch (err) {
        logger.error(`Webhook booking update failed: ${err.message}`);
      }
    }
  }

  res.json({ received: true });
};

export const addToWishlist = async (req, res) => {
  try {
    const { propertyId, checkIn, checkOut, guests } = req.body;

    const inDate = parseDate(checkIn);
    const outDate = parseCheckOut(checkOut);

    if (outDate <= inDate) {
      return sendError(res, 'Check-out must be after check-in', 400);
    }

    const nights = nightsBetween(inDate, outDate);
    if (nights < 1) {
      return sendError(res, 'Minimum stay is 1 night', 400);
    }

    const property = await Property.findById(propertyId).lean();
    if (!property) return sendNotFound(res, 'Property not found');

    const minNights = property.minNights || 1;
    if (nights < minNights) {
      return sendError(res, `Minimum stay is ${minNights} night(s)`, 400);
    }

    const totalAdults = guests?.adults || 1;
    const totalChildren = guests?.children || 0;
    if (totalAdults > (property.maxAdults || 99)) {
      return sendError(res, `Maximum ${property.maxAdults} adult(s) allowed`, 400);
    }
    if (totalChildren > (property.maxChildren || 99)) {
      return sendError(res, `Maximum ${property.maxChildren} children allowed`, 400);
    }

    const gap = GAP_HOURS * 60 * 60 * 1000;
    const effectiveIn = new Date(inDate.getTime() - gap);
    const effectiveOut = new Date(outDate.getTime() + gap);

    const conflicting = await Booking.findOne({
      property: propertyId,
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        { checkIn: { $lt: effectiveOut }, checkOut: { $gt: effectiveIn } },
      ],
    }).lean();

    if (conflicting) {
      return sendError(res, 'This property is not available for the selected dates', 409);
    }

    const nightlyRate = parseFloat(property.price) || 0;
    const subtotal = nightlyRate * nights;
    const cleaningFee = parseFloat(property.cleaningFee) || 0;
    const serviceFee = Math.round((subtotal + cleaningFee) * 0.12);
    const totalAmount = subtotal + cleaningFee + serviceFee;

    const commissionRate = await getApplicableRate(property.propertyType);
    const commissionAmount = Math.round(totalAmount * (commissionRate / 100));

    const booking = await Booking.create({
      property: propertyId,
      user: req.user._id,
      checkIn: inDate,
      checkOut: outDate,
      guests: { adults: totalAdults, children: totalChildren },
      totalAmount,
      serviceFee,
      commissionRate,
      commissionAmount,
      source: 'wishlist',
    });

    return sendCreated(res, { booking });
  } catch (err) {
    logger.error(`addToWishlist: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const getWishlist = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id, source: 'wishlist' })
      .populate('property', 'name city country images price cleaningFee propertyType')
      .sort({ createdAt: -1 })
      .lean();
    return sendSuccess(res, { bookings });
  } catch (err) {
    logger.error(`getWishlist: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return sendNotFound(res, 'Wishlist item not found');

    if (booking.user.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return sendError(res, 'Not authorized', 403);
    }

    if (booking.source !== 'wishlist') {
      return sendError(res, 'This is not a wishlist item', 400);
    }

    await Booking.findByIdAndDelete(req.params.id);
    return sendSuccess(res, null, 'Removed from wishlist');
  } catch (err) {
    logger.error(`removeFromWishlist: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      user: req.user._id,
      $or: [
        { status: { $ne: 'pending' } },
        { source: 'wishlist' },
      ],
    })
      .populate('property', 'name city country images price cleaningFee propertyType')
      .sort({ createdAt: -1 })
      .lean();
    return sendSuccess(res, { bookings });
  } catch (err) {
    logger.error(`getUserBookings: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('property', 'name city country images price propertyType address')
      .populate('user', 'name email')
      .lean();

    if (!booking) return sendNotFound(res, 'Booking not found');
    if (booking.user._id.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return sendError(res, 'Not authorized', 403);
    }

    return sendSuccess(res, { booking });
  } catch (err) {
    logger.error(`getBookingById: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return sendNotFound(res, 'Booking not found');

    if (booking.user.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return sendError(res, 'Not authorized', 403);
    }

    if (booking.status === 'cancelled') {
      return sendError(res, 'Booking is already cancelled', 400);
    }

    if (booking.status === 'confirmed') {
      const now = new Date();
      const checkIn = new Date(booking.checkIn);
      const msPerDay = 1000 * 60 * 60 * 24;
      const diffDays = Math.ceil((checkIn.getTime() - now.getTime()) / msPerDay);
      if (diffDays < 1) {
        return sendError(res, 'Cancellation is only allowed up to 1 day before check-in', 400);
      }
    }

    const refund = await calculateRefund(booking._id);
    const wasPaidConfirmed = booking.status === 'confirmed';
    const hasStripeSession = booking.stripeSessionId && booking.stripeSessionId.length > 0;
    const mustRefund = (wasPaidConfirmed || hasStripeSession) && refund.refundAmount > 0;

    booking.status = 'cancelled';

    if (mustRefund) {
      let paymentIntent = null;

      if (booking.stripeSessionId) {
        try {
          const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
          paymentIntent = session.payment_intent;
        } catch { /* session not found, try fallback */ }
      }

      if (paymentIntent) {
        try {
          await stripe.refunds.create({
            payment_intent: paymentIntent,
            amount: Math.round(refund.refundAmount * 100),
          });
          booking.refundStatus = 'processed';
          booking.refundRetryCount = 0;
          booking.refundLastError = '';
        } catch (stripeErr) {
          logger.error(`Stripe refund failed: ${stripeErr.message}`);
          booking.refundStatus = 'failed';
          booking.refundLastError = stripeErr.message;
          booking.refundRetryCount = (booking.refundRetryCount || 0) + 1;
        }
      } else {
        booking.refundStatus = 'pending';
        booking.refundLastError = 'No valid Stripe session — manual refund required';
      }
    } else {
      booking.refundStatus = wasPaidConfirmed || hasStripeSession ? 'none' : 'none';
    }

    booking.refundAmount = refund.refundAmount;
    booking.platformRefundFee = refund.platformFee;
    booking.ownerRefundFee = refund.ownerFee;
    booking.refundedAt = refund.refundAmount > 0 ? new Date() : undefined;
    await booking.save();

    return sendSuccess(res, { booking, refund }, 'Booking cancelled');
  } catch (err) {
    logger.error(`cancelBooking: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const retryRefund = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return sendNotFound(res, 'Booking not found');
    if (booking.refundStatus !== 'failed') {
      return sendError(res, 'Only failed refunds can be retried', 400);
    }
    if (!booking.stripeSessionId) {
      return sendError(res, 'No Stripe session reference — cannot auto-retry. Process manually.', 400);
    }

    const refundAmount = booking.refundAmount;
    if (!refundAmount || refundAmount <= 0) {
      return sendError(res, 'No refund amount to process', 400);
    }

    let paymentIntent = null;
    try {
      const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
      paymentIntent = session.payment_intent;
    } catch {
      return sendError(res, 'Could not retrieve Stripe session', 500);
    }

    if (!paymentIntent) {
      return sendError(res, 'No payment intent found for this booking', 500);
    }

    try {
      await stripe.refunds.create({
        payment_intent: paymentIntent,
        amount: Math.round(refundAmount * 100),
      });
      booking.refundStatus = 'processed';
      booking.refundRetryCount = 0;
      booking.refundLastError = '';
      await booking.save();
      return sendSuccess(res, { booking }, 'Refund processed successfully');
    } catch (stripeErr) {
      booking.refundRetryCount = (booking.refundRetryCount || 0) + 1;
      booking.refundLastError = stripeErr.message;
      await booking.save();
      return sendError(res, `Refund failed: ${stripeErr.message}`);
    }
  } catch (err) {
    logger.error(`retryRefund: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const getAllBookings = async (req, res) => {
  try {
    const filter = {};
    const { status, search, refundStatus_ne, page, limit } = req.query;

    if (req.user.role === 'Owner' || req.user.role === 'Property Owner') {
      const props = await Property.find({ owner: req.user._id }).select('_id').lean();
      filter.property = { $in: props.map(p => p._id) };
    }

    if (status && status !== 'All') {
      filter.status = status.toLowerCase();
    }

    if (refundStatus_ne) {
      filter.refundStatus = { $ne: refundStatus_ne };
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 200));
    const skip = (pageNum - 1) * limitNum;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('property', 'name city country')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Booking.countDocuments(filter),
    ]);

    const mapped = bookings.map(b => ({
      _id: b._id,
      invoiceNumber: b.invoiceNumber || b._id?.toString().slice(-6),
      guest: b.user?.name || 'Unknown',
      email: b.user?.email || '',
      stay: b.property?.name || 'Unknown',
      location: [b.property?.city, b.property?.country].filter(Boolean).join(', '),
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: Math.round((new Date(b.checkOut) - new Date(b.checkIn)) / (1000 * 60 * 60 * 24)),
      guests: (b.guests?.adults || 0) + (b.guests?.children || 0),
      amount: b.totalAmount,
      status: b.status ? (b.status.charAt(0).toUpperCase() + b.status.slice(1)) : 'Pending',
      payment: b.status === 'confirmed' ? 'Paid' : b.status === 'cancelled' ? 'Refunded' : 'Pending',
      created: b.createdAt,
      refundStatus: b.refundStatus || 'none',
      refundAmount: b.refundAmount || 0,
      platformRefundFee: b.platformRefundFee || 0,
      ownerRefundFee: b.ownerRefundFee || 0,
      refundLastError: b.refundLastError || '',
    }));

    return sendSuccess(res, { bookings: mapped, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    logger.error(`getAllBookings: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const retryPayment = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('property').lean();
    if (!booking) return sendNotFound(res, 'Booking not found');

    if (booking.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'Not authorized', 403);
    }

    if (booking.status !== 'pending') {
      return sendError(res, 'Only pending bookings can be paid', 400);
    }

    const property = booking.property;
    const nights = Math.round((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24));
    const frontendUrl = req.body.clientUrl || process.env.CLIENT_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: req.user.email,
      client_reference_id: booking._id.toString(),
      metadata: {
        bookingId: booking._id.toString(),
        propertyId: property._id.toString(),
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: property.name || 'Property Stay',
              description: `${nights} night(s) · ${new Date(booking.checkIn).toLocaleDateString()} - ${new Date(booking.checkOut).toLocaleDateString()}`,
              images: property.images?.length ? [property.images[0]?.url || property.images[0]] : [],
            },
            unit_amount: Math.round((property.price || 0) * 100),
          },
          quantity: nights,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Cleaning Fee' },
            unit_amount: Math.round((property.cleaningFee || 0) * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Service Fee' },
            unit_amount: Math.round((booking.serviceFee || 0) * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/booking/confirmation?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking._id}`,
      cancel_url: `${frontendUrl}/property/${property._id}?cancelled=true`,
    });

    const commissionRate = await getApplicableRate(booking.property?.propertyType);
    const commissionAmount = Math.round(booking.totalAmount * (commissionRate / 100));
    await Booking.findByIdAndUpdate(booking._id, {
      stripeSessionId: session.id,
      commissionRate,
      commissionAmount,
    });
    return sendSuccess(res, { url: session.url, sessionId: session.id, bookingId: booking._id });
  } catch (err) {
    logger.error(`retryPayment: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('property').populate('user', 'name email');
    if (!booking) return sendNotFound(res, 'Booking not found');

    if (booking.user._id.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return sendError(res, 'Not authorized', 403);
    }

    if (booking.status === 'confirmed' || booking.status === 'completed') {
      return sendSuccess(res, { booking: { status: booking.status, invoiceNumber: booking.invoiceNumber } });
    }

    if (booking.status !== 'pending') {
      return sendError(res, 'Booking cannot be confirmed', 400);
    }

    if (!booking.stripeSessionId) {
      return sendError(res, 'No Stripe session found for this booking', 400);
    }

    const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);

    if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      booking.status = 'confirmed';
      booking.invoiceNumber = invoiceNumber;
      booking.paidAt = new Date();
      await booking.save();

      try {
        await generateInvoice(booking);
      } catch (invErr) {
        logger.error(`Invoice generation failed: ${invErr.message}`);
      }

      return sendSuccess(res, { booking: { status: 'confirmed', invoiceNumber } });
    }

    return sendError(res, `Payment not completed — status: ${session.payment_status}`, 400);
  } catch (err) {
    logger.error(`confirmPayment: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const getBookingInvoice = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('property', 'name city country address price cleaningFee bedrooms beds bathrooms maxAdults maxChildren propertyType')
      .populate('user', 'name email phone')
      .lean();

    if (!booking) return sendNotFound(res, 'Booking not found');

    if (booking.user._id.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return sendError(res, 'Not authorized', 403);
    }

    const pdfBuffer = await generateInvoice(booking, true);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${booking.invoiceNumber || booking._id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) {
    logger.error(`getBookingInvoice: ${err.message}`);
    return sendError(res, err.message);
  }
};
