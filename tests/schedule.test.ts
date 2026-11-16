import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setupTestDb } from './setup.js';
import { registerUser, bearer } from './helpers.js';

beforeEach(async () => {
  await setupTestDb();
});

describe('weekly schedule', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/schedule');
    expect(res.status).toBe(401);
  });

  it('starts empty', async () => {
    const u = await registerUser('Ann', 'ann@example.com');
    const res = await request(app).get('/api/schedule').set(bearer(u));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ availability: {} });
  });

  it('saves, normalizes and replaces availability', async () => {
    const u = await registerUser('Ann', 'ann@example.com');
    const saved = await request(app)
      .put('/api/schedule')
      .set(bearer(u))
      .send({
        availability: {
          Monday: ['09:00 AM', '01:00 PM', '09:00'],
          Sunday: ['10:00 AM'],
        },
      });
    expect(saved.status).toBe(200);
    expect(saved.body.availability).toEqual({
      Monday: ['09:00', '13:00'],
      Sunday: ['10:00'],
    });

    const replaced = await request(app)
      .put('/api/schedule')
      .set(bearer(u))
      .send({ availability: { Tuesday: ['02:00 PM'] } });
    expect(replaced.body.availability).toEqual({ Tuesday: ['14:00'] });

    const got = await request(app).get('/api/schedule').set(bearer(u));
    expect(got.body.availability).toEqual({ Tuesday: ['14:00'] });
  });

  it('keeps schedules private per user', async () => {
    const a = await registerUser('Ann', 'ann@example.com');
    const b = await registerUser('Bob', 'bob@example.com');
    await request(app)
      .put('/api/schedule')
      .set(bearer(a))
      .send({ availability: { Friday: ['09:00 AM'] } });
    const res = await request(app).get('/api/schedule').set(bearer(b));
    expect(res.body.availability).toEqual({});
  });

  it('rejects bad hours and a missing body', async () => {
    const u = await registerUser('Ann', 'ann@example.com');
    const bad = await request(app)
      .put('/api/schedule')
      .set(bearer(u))
      .send({ availability: { Monday: ['25:00'] } });
    expect(bad.status).toBe(400);
    const missing = await request(app)
      .put('/api/schedule')
      .set(bearer(u))
      .send({});
    expect(missing.status).toBe(400);
  });

  it('clears the schedule', async () => {
    const u = await registerUser('Ann', 'ann@example.com');
    await request(app)
      .put('/api/schedule')
      .set(bearer(u))
      .send({ availability: { Monday: ['09:00 AM'] } });
    const del = await request(app).delete('/api/schedule').set(bearer(u));
    expect(del.status).toBe(204);
    const got = await request(app).get('/api/schedule').set(bearer(u));
    expect(got.body.availability).toEqual({});
  });
});
