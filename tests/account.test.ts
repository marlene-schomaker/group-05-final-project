import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setupTestDb } from './setup.js';
import { bearer, registerUser, type TestUser } from './helpers.js';

let alice: TestUser;

beforeEach(async () => {
  await setupTestDb();
  alice = await registerUser('Alice', 'alice@example.com');
});

describe('GET /api/account/profile', () => {
  it('returns the authenticated user profile without secrets', async () => {
    const res = await request(app)
      .get('/api/account/profile')
      .set(bearer(alice));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: 'alice@example.com',
      name: 'Alice',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/account/profile');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/account/profile', () => {
  it('updates the display name and email', async () => {
    const res = await request(app)
      .put('/api/account/profile')
      .set(bearer(alice))
      .send({ name: 'Alice B', email: 'Alice.B@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Alice B',
      email: 'alice.b@example.com',
    });
  });

  it('rejects an empty name and an invalid email', async () => {
    const res = await request(app)
      .put('/api/account/profile')
      .set(bearer(alice))
      .send({ name: '', email: 'nope' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an email that belongs to someone else', async () => {
    await registerUser('Bob', 'bob@example.com');
    const res = await request(app)
      .put('/api/account/profile')
      .set(bearer(alice))
      .send({ email: 'bob@example.com' });

    expect(res.status).toBe(409);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .put('/api/account/profile')
      .send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('notification preferences', () => {
  it('returns the defaults from the design', async () => {
    const res = await request(app)
      .get('/api/account/preferences')
      .set(bearer(alice));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      prefInvites: true,
      prefConfirmed: true,
      prefEmail: false,
    });
  });

  it('updates preferences', async () => {
    const res = await request(app)
      .put('/api/account/preferences')
      .set(bearer(alice))
      .send({ prefInvites: false, prefEmail: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      prefInvites: false,
      prefConfirmed: true,
      prefEmail: true,
    });
  });

  it('rejects non-boolean values', async () => {
    const res = await request(app)
      .put('/api/account/preferences')
      .set(bearer(alice))
      .send({ prefInvites: 'yes' });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/account/preferences')).status).toBe(
      401,
    );
    expect(
      (await request(app).put('/api/account/preferences').send({})).status,
    ).toBe(401);
  });
});

describe('POST /api/support/contact', () => {
  it('accepts a request from a signed-out visitor', async () => {
    const res = await request(app).post('/api/support/contact').send({
      email: 'visitor@example.com',
      subject: 'Help',
      message: 'I cannot sign in',
    });

    expect(res.status).toBe(201);
    expect(res.body.ticketId).toBeTruthy();
  });

  it('accepts a request from a signed-in user', async () => {
    const res = await request(app)
      .post('/api/support/contact')
      .set(bearer(alice))
      .send({
        email: 'alice@example.com',
        subject: 'Help',
        message: 'Question',
      });
    expect(res.status).toBe(201);
  });

  it('validates the body', async () => {
    const res = await request(app)
      .post('/api/support/contact')
      .send({ email: 'bad', subject: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
