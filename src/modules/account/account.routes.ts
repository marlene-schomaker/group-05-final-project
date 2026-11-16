import { Router } from 'express';
import { AccountController } from './account.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  updateProfileSchema,
  updatePreferencesSchema,
} from './account.validation.js';

const router = Router();

router.use(authenticate);

router.get('/profile', AccountController.getProfile);
router.put(
  '/profile',
  validate(updateProfileSchema),
  AccountController.updateProfile,
);
router.get('/preferences', AccountController.getPreferences);
router.put(
  '/preferences',
  validate(updatePreferencesSchema),
  AccountController.updatePreferences,
);

export default router;
