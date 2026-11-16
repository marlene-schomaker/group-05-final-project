import { Router } from 'express';
import { SupportController } from './support.controller.js';
import { optionalAuthenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { contactSupportSchema } from './support.validation.js';

const router = Router();

router.post(
  '/contact',
  optionalAuthenticate,
  validate(contactSupportSchema),
  SupportController.contactSupport,
);

export default router;
