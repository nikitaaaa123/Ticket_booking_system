import { Router } from 'express';
import { SeatsController } from '../controllers/seats.controller.ts';
import { optionalAuthenticate } from '../middlewares/auth.middleware.ts';

const router = Router();

// Public / Authenticated Seat Map retrieval
router.get('/show/:showId', optionalAuthenticate, SeatsController.getSeatMap);

// Hold and Release operations
router.post('/hold', optionalAuthenticate, SeatsController.holdSeats);
router.post('/release', optionalAuthenticate, SeatsController.releaseSeats);
router.post('/verify-hold', optionalAuthenticate, SeatsController.verifyHold);
router.post('/verify', optionalAuthenticate, SeatsController.verifyHold);

export default router;
