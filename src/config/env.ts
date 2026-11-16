import crypto from 'crypto';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

const secret = (name: string) =>
  isTest
    ? z
        .string()
        .min(16)
        .default(() => crypto.randomBytes(32).toString('hex'))
    : z
        .string({ error: `${name} is required` })
        .min(16, `${name} must be at least 16 characters`);

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: isTest
    ? z.string().default('postgres://test:test@localhost:5432/test')
    : z.string({ error: 'DATABASE_URL is required' }).min(1),
  JWT_SECRET: secret('JWT_SECRET'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(200),
  NODE_ENV: z.string().default('development'),
});

export const env = envSchema.parse(process.env);
