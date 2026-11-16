import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setupTestDb } from './setup.js';
import {
  addMember,
  bearer,
  createEvent,
  createGroup,
  registerUser,
  slot,
  type TestUser,
} from './helpers.js';

let ava: TestUser;
let marcus: TestUser;

beforeEach(async () => {
  await setupTestDb();
  ava = await registerUser('Ava', 'ava@example.com');
  marcus = await registerUser('Marcus', 'marcus@example.com');
});

describe('GET /api/home', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/home')).status).toBe(401);
  });

  it('returns empty sections for a new user', async () => {
    const res = await request(app).get('/api/home').set(bearer(ava));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      groups: [],
      invites: [],
      groupInvites: [],
      upcoming: [],
      unreadNotificationsCount: 0,
    });
  });

  it('aggregates groups, "Waiting on you", "Coming up" and the unread badge', async () => {
    const groupId = (await createGroup(ava, { name: 'Study Crew' })).id;
    await addMember(groupId, marcus);

    const event = await createEvent(ava, groupId, {
      name: 'Saturday study session',
      inviteEmails: ['marcus@example.com'],
      minAttendees: 2,
      minDurationMinutes: 120,
    });

    const before = await request(app).get('/api/home').set(bearer(marcus));
    expect(before.body.groups[0]).toMatchObject({
      name: 'Study Crew',
      initial: 'S',
      membersLabel: '2 members',
      next: '1 event waiting for people',
    });
    expect(before.body.invites).toEqual([
      expect.objectContaining({
        name: 'Saturday study session',
        group: 'Study Crew, invited by Ava',
        rule: 'At least 2 hr, needs 2 people',
      }),
    ]);
    expect(before.body.upcoming).toEqual([]);
    expect(before.body.unreadNotificationsCount).toBe(1);

    await request(app)
      .post(`/api/events/${event.id}/availability`)
      .set(bearer(ava))
      .send({ slots: [slot('18:30', '21:00')] });
    await request(app)
      .post(`/api/events/${event.id}/availability`)
      .set(bearer(marcus))
      .send({ slots: [slot('18:30', '21:00')] });

    const after = await request(app).get('/api/home').set(bearer(marcus));
    expect(after.body.invites).toEqual([]);
    expect(after.body.upcoming).toEqual([
      expect.objectContaining({
        name: 'Saturday study session',
        dow: 'SAT',
        day: '14',
        meta: 'Study Crew, 6:30 PM to 8:30 PM',
      }),
    ]);
    expect(after.body.groups[0].next).toMatch(/^Next: Sat 6:30 PM$/);
  });

  it('lists pending group invitations', async () => {
    const groupId = (await createGroup(ava)).id;
    await request(app)
      .post(`/api/groups/${groupId}/invites`)
      .set(bearer(ava))
      .send({ emails: ['marcus@example.com'] });

    const res = await request(app).get('/api/home').set(bearer(marcus));
    expect(res.body.groupInvites).toEqual([
      expect.objectContaining({ groupName: 'Study Crew', invitedBy: 'Ava' }),
    ]);
  });
});

describe('unknown routes and malformed requests', () => {
  it('returns the standard error body for an unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns INVALID_JSON for a malformed body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('exposes a health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
