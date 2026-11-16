import { describe, it, expect } from 'vitest';
import request from 'supertest';

describe('rate limiting', () => {
  it('returns 429 with the standard error body once the limit is exceeded', async () => {
    process.env.RATE_LIMIT_MAX = '3';
    // must import after setting the env so the limiter reads the low limit
    const { app } = await import('../src/app.js');

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push((await request(app).get('/api/home')).status);
    }
    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);

    const limited = await request(app).get('/api/home');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});
