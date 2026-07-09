import { Router } from 'express';
import {
  checkAvailability,
  createCheckoutSession,
  getUserBookings,
  getBookingById,
  cancelBooking,
  getBookingInvoice,
  retryPayment,
  confirmPayment,
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  retryRefund,
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

router.post(
  '/wishlist',
  protect,
  [
    body('propertyId').isMongoId().withMessage('Valid property ID is required'),
    body('checkIn').isISO8601().withMessage('Valid check-in date is required'),
    body('checkOut').isISO8601().withMessage('Valid check-out date is required'),
  ],
  validate,
  addToWishlist
);
router.get('/wishlist', protect, getWishlist);
router.delete('/wishlist/:id', protect, mongoIdParam('id'), validate, removeFromWishlist);

router.get('/mine', protect, getUserBookings);
router.get('/:id', protect, mongoIdParam('id'), validate, getBookingById);
router.get('/:id/invoice', protect, mongoIdParam('id'), validate, getBookingInvoice);
router.post('/:id/retry-payment', protect, mongoIdParam('id'), validate, retryPayment);
router.post('/:id/cancel', protect, mongoIdParam('id'), validate, cancelBooking);
router.post('/:id/confirm-payment', protect, mongoIdParam('id'), validate, confirmPayment);
router.post('/:id/retry-refund', protect, mongoIdParam('id'), validate, retryRefund);

export default router;
