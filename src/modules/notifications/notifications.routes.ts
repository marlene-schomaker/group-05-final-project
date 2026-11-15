import { Router } from 'express';
import { NotificationsController } from './notifications.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listNotificationsSchema,
  notificationIdSchema,
} from './notifications.validation.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validate(listNotificationsSchema),
  NotificationsController.list,
);
router.get('/unread-count', NotificationsController.getUnreadCount);
router.post('/mark-all-read', NotificationsController.markAllRead);
router.patch(
  '/:id/read',
  validate(notificationIdSchema),
  NotificationsController.markRead,
);

export default router;
