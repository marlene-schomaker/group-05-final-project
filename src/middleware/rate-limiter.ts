import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { errorBody } from './error-handler.js';

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorBody(
    'RATE_LIMITED',
    'Too many requests, please try again later.',
  ),
});

export const authRateLimiter = rateLimit({
  skip: () => Boolean(process.env.VITEST),
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: Math.max(10, Math.floor(env.RATE_LIMIT_MAX / 4)),
  standardHeaders: true,
  legacyHeaders: false,
  message: errorBody(
    'RATE_LIMITED',
    'Too many attempts, please try again later.',
  ),
});
