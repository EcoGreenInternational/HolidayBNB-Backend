import Stripe from 'stripe';
import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
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

    const booking = await Booking.create({
      property: propertyId,
      user: req.user._id,
      checkIn: inDate,
      checkOut: outDate,
      guests: { adults: totalAdults, children: totalChildren },
      totalAmount,
      serviceFee,
    });

    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';

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
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
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

export const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('property', 'name city country images price propertyType')
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

    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      return sendError(res, 'Booking cannot be cancelled', 400);
    }

    booking.status = 'cancelled';
    await booking.save();

    return sendSuccess(res, { booking }, 'Booking cancelled');
  } catch (err) {
    logger.error(`cancelBooking: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const getAllBookings = async (req, res) => {
  try {
    const filter = {};
    const { status, search } = req.query;

    if (req.user.role === 'Owner' || req.user.role === 'Property Owner') {
      const props = await Property.find({ owner: req.user._id }).select('_id').lean();
      filter.property = { $in: props.map(p => p._id) };
    }

    if (status && status !== 'All') {
      filter.status = status.toLowerCase();
    }

    const bookings = await Booking.find(filter)
      .populate('property', 'name city country')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();

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
    }));

    return sendSuccess(res, { bookings: mapped, total: mapped.length });
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
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';

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

    await Booking.findByIdAndUpdate(booking._id, { stripeSessionId: session.id });
    return sendSuccess(res, { url: session.url, sessionId: session.id, bookingId: booking._id });
  } catch (err) {
    logger.error(`retryPayment: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const getBookingInvoice = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('property', 'name city country address')
      .populate('user', 'name email')
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
