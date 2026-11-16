import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/database.js';
import { setupTestDb } from './setup.js';
import { bearer, registerUser, createGroup, createEvent } from './helpers.js';

beforeEach(async () => {
  await setupTestDb();
});

describe('POST /api/auth/register', () => {
  it('creates an account and never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ava', email: 'Ava@Example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      name: 'Ava',
      email: 'ava@example.com',
    });
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('rejects an invalid email or short password with a VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ava', email: 'not-an-email', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map(
      (d: { field: string }) => d.field,
    );
    expect(fields).toEqual(
      expect.arrayContaining(['body.email', 'body.password']),
    );
  });

  it('rejects a duplicate email with 409', async () => {
    await registerUser('Ava', 'ava@example.com');
    const res = await request(app).post('/api/auth/register').send({
      name: 'Other',
      email: 'AVA@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('attaches earlier event and group invitations to the new account', async () => {
    const owner = await registerUser('Ava', 'ava@example.com');
    const group = await createGroup(owner);
    await createEvent(owner, group.id, {
      inviteEmails: ['newbie@example.com'],
      minAttendees: 2,
    });
    await request(app)
      .post(`/api/groups/${group.id}/invites`)
      .set(bearer(owner))
      .send({ emails: ['newbie@example.com'] });

    const newbie = await registerUser('Newbie', 'newbie@example.com');

    const invite = await db
      .selectFrom('event_invites')
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(invite.user_id).toBe(newbie.id);

    const notes = await request(app)
      .get('/api/notifications')
      .set(bearer(newbie));
    const types = notes.body.items.map((n: { type: string }) => n.type).sort();
    expect(types).toEqual(['event_invite', 'group_invite']);

    const groups = await request(app).get('/api/groups').set(bearer(newbie));
    expect(groups.body).toHaveLength(0);
  });
});

describe('original /api/v1/auth contract', () => {
  it('registers with only an email and password and returns a token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'Plain@Example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBe(res.body.accessToken);
    expect(res.body.user).toMatchObject({
      email: 'plain@example.com',
      name: 'plain',
    });
    expect(res.body.user.id).toBeTruthy();
    expect(res.body.user.created_at).toBeTruthy();
  });

  it('logs in and returns a token that works on protected routes', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'plain@example.com', password: 'password123' });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'plain@example.com', password: 'password123' });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set({ Authorization: `Bearer ${login.body.token}` });
    expect(me.status).toBe(200);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials', async () => {
    await registerUser('Ava', 'ava@example.com');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ava@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe('ava@example.com');
  });

  it('rejects a wrong password and an unknown email the same way', async () => {
    await registerUser('Ava', 'ava@example.com');
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ava@example.com', password: 'nope-nope' });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'password123' });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('validates the request body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/refresh and /logout', () => {
  it('rotates the refresh token and rejects reuse of the old one', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ava', email: 'ava@example.com', password: 'password123' });

    const first = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeTruthy();

    const reuse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('rejects a malformed refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'garbage' });
    expect(res.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ava', email: 'ava@example.com', password: 'password123' });

    const out = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: reg.body.refreshToken });
    expect(out.status).toBe(200);

    const after = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken });
    expect(after.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the token owner', async () => {
    const user = await registerUser('Ava', 'ava@example.com');
    const res = await request(app).get('/api/auth/me').set(bearer(user));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ava@example.com');
  });

  it('returns 401 without a token or with a bad one', async () => {
    const none = await request(app).get('/api/auth/me');
    expect(none.status).toBe(401);
    expect(none.body.error.code).toBe('UNAUTHORIZED');

    const bad = await request(app)
      .get('/api/auth/me')
      .set({ Authorization: 'Bearer abc.def.ghi' });
    expect(bad.status).toBe(401);
  });
});
