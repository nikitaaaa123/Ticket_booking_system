import { Router } from 'express';
import { WaitlistController } from '../controllers/waitlist.controller.ts';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware.ts';

const router = Router();

// Endpoint 1: Join Waitlist (Authenticated or Guest)
router.post('/join', optionalAuthenticate, WaitlistController.joinWaitlist);

// Customer's active waitlist entries (Requires JWT auth)
router.get('/my-waitlist', authenticate, WaitlistController.getMyWaitlist);

// Endpoint 3: Inspect offer details by token (Public link from email)
router.get('/offers/:token', optionalAuthenticate, WaitlistController.getOfferDetails);

// Endpoint 3: Accept offer & complete booking
router.post('/offers/:token/accept', optionalAuthenticate, WaitlistController.acceptOffer);

// Endpoint: Decline offer & immediately yield to next customer
router.post('/offers/:token/decline', optionalAuthenticate, WaitlistController.declineOffer);

export default router;
