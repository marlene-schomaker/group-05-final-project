import { Router } from 'express';
import { EventsController } from './events.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireGroupMember } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  createEventSchema,
  eventIdParamSchema,
  respondInviteSchema,
  submitAvailabilitySchema,
} from './events.validation.js';

const router = Router();

// Mounted at /api: authenticate per route, never router.use, or it would
// intercept every /api path mounted after this router.
router.get(
  '/groups/:groupId/events',
  authenticate,
  requireGroupMember('groupId'),
  EventsController.listByGroup,
);
router.post(
  '/groups/:groupId/events',
  authenticate,
  validate(createEventSchema),
  requireGroupMember('groupId'),
  EventsController.create,
);

router.get(
  '/events/:id',
  authenticate,
  validate(eventIdParamSchema),
  EventsController.getById,
);
router.delete(
  '/events/:id',
  authenticate,
  validate(eventIdParamSchema),
  EventsController.cancel,
);
router.put(
  '/events/:id/respond',
  authenticate,
  validate(respondInviteSchema),
  EventsController.respond,
);
router.get(
  '/events/:id/availability',
  authenticate,
  validate(eventIdParamSchema),
  EventsController.getAvailability,
);
router.post(
  '/events/:id/availability',
  authenticate,
  validate(submitAvailabilitySchema),
  EventsController.submitAvailability,
);

export default router;
