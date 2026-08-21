import { Router } from 'express';
import { VenuesController } from '../controllers/venues.controller.ts';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.ts';

const router = Router();

// Public / Authenticated read
router.get('/', VenuesController.listVenues);
router.get('/:id', VenuesController.getVenueById);

// Admin Only endpoints
router.post('/', authenticate, authorizeRoles('ADMIN'), VenuesController.createVenue);
router.post('/:id/categories', authenticate, authorizeRoles('ADMIN'), VenuesController.addCategory);
router.post('/:id/seats/grid', authenticate, authorizeRoles('ADMIN'), VenuesController.defineSeatGrid);

export default router;
