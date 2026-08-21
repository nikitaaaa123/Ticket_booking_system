import { Router } from 'express';
import { BookingsController } from '../controllers/bookings.controller.ts';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware.ts';

const router = Router();

// Confirm booking (works for authenticated users and guests with session token)
router.post('/confirm', optionalAuthenticate, BookingsController.confirmBooking);

// Customer booking history (requires JWT authentication)
router.get('/my-bookings', authenticate, BookingsController.getMyBookings);

// Cancel booking (requires JWT authentication)
router.post('/cancel', authenticate, BookingsController.cancelBooking);

export default router;
