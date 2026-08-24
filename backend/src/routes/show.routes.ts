import { Router } from 'express';
import { ShowsController } from '../controllers/shows.controller.ts';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.ts';

const router = Router();

// Public / Customer show browsing
router.get('/', ShowsController.listShows);
router.get('/:id', ShowsController.getShowById);

// Organiser / Admin Show Management endpoints
router.get(
  '/organiser/my-shows',
  authenticate,
  authorizeRoles('ORGANISER', 'ADMIN'),
  ShowsController.listOrganiserShows
);

router.post(
  '/',
  authenticate,
  authorizeRoles('ORGANISER', 'ADMIN'),
  ShowsController.createShow
);

router.put(
  '/:id',
  authenticate,
  authorizeRoles('ORGANISER', 'ADMIN'),
  ShowsController.updateShow
);

router.get(
  '/:id/summary',
  authenticate,
  authorizeRoles('ORGANISER', 'ADMIN'),
  ShowsController.getShowSummary
);

router.get(
  '/:id/revenue',
  authenticate,
  authorizeRoles('ORGANISER', 'ADMIN'),
  ShowsController.getShowSummary
);

export default router;
