import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { authRateLimiter } from '../../middleware/rate-limiter.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from './auth.validation.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  AuthController.register,
);
router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  AuthController.login,
);
router.post(
  '/refresh',
  authRateLimiter,
  validate(refreshSchema),
  AuthController.refresh,
);
router.post('/logout', AuthController.logout);
router.get('/me', authenticate, AuthController.me);

export default router;
