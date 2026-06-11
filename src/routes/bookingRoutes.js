import { Router } from 'express';
import {
  checkAvailability,
  createCheckoutSession,
  getUserBookings,
  getBookingById,
  cancelBooking,
  getBookingInvoice,
  retryPayment,
} from '../controllers/bookingController.js';
import { protect } from '../middleware/protect.js';
import { mongoIdParam } from '../middleware/validators.js';
import validate from '../middleware/validate.js';
import { body } from 'express-validator';

const router = Router();

router.get('/availability/:propertyId', mongoIdParam('propertyId'), validate, checkAvailability);

router.post(
  '/create-session',
  protect,
  [
    body('propertyId').isMongoId().withMessage('Valid property ID is required'),
    body('checkIn').isISO8601().withMessage('Valid check-in date is required'),
    body('checkOut').isISO8601().withMessage('Valid check-out date is required'),
  ],
  validate,
  createCheckoutSession
);

router.get('/mine', protect, getUserBookings);
router.get('/:id', protect, mongoIdParam('id'), validate, getBookingById);
router.get('/:id/invoice', protect, mongoIdParam('id'), validate, getBookingInvoice);
router.post('/:id/retry-payment', protect, mongoIdParam('id'), validate, retryPayment);
router.post('/:id/cancel', protect, mongoIdParam('id'), validate, cancelBooking);

export default router;
