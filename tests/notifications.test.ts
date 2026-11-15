import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/database.js';
import { setupTestDb } from './setup.js';
import {
  addMember,
  bearer,
  createEvent,
  createGroup,
  registerUser,
  type TestUser,
} from './helpers.js';

let ava: TestUser;
let marcus: TestUser;
let outsider: TestUser;

beforeEach(async () => {
  await setupTestDb();
  ava = await registerUser('Ava', 'ava@example.com');
  marcus = await registerUser('Marcus', 'marcus@example.com');
  outsider = await registerUser('Outsider', 'outsider@example.com');

  const groupId = (await createGroup(ava)).id;
  await addMember(groupId, marcus);
  await createEvent(ava, groupId, {
    inviteEmails: ['marcus@example.com'],
    minAttendees: 2,
  });
  await request(app)
    .post(`/api/groups/${groupId}/invites`)
    .set(bearer(ava))
    .send({ emails: ['outsider@example.com'] });
  await db
    .insertInto('notifications')
    .values({
      user_id: marcus.id,
      type: 'event_confirmed',
      title: 'Pickup game is confirmed for Friday',
      body: 'Friday Pickup Soccer.',
      icon: '✓',
      action_label: 'View event',
      action_url: '/groups/1',
    })
    .execute();
});

describe('GET /api/notifications', () => {
  it('lists notifications with the design fields and the unread count', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set(bearer(marcus));

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(2);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({
      isRead: false,
      dot: '#3B5BDB',
      when: 'Just now',
    });
    expect(res.body.items.map((n: { type: string }) => n.type).sort()).toEqual([
      'event_confirmed',
      'event_invite',
    ]);
  });

  it('filters into Invites and Event updates', async () => {
    const invites = await request(app)
      .get('/api/notifications?filter=invites')
      .set(bearer(marcus));
    expect(invites.body.items.map((n: { type: string }) => n.type)).toEqual([
      'event_invite',
    ]);

    const updates = await request(app)
      .get('/api/notifications?filter=updates')
      .set(bearer(marcus));
    expect(updates.body.items.map((n: { type: string }) => n.type)).toEqual([
      'event_confirmed',
    ]);
    expect(updates.body.items[0].icon).toBe('✓');

    const outsiderInvites = await request(app)
      .get('/api/notifications?filter=invites')
      .set(bearer(outsider));
    expect(
      outsiderInvites.body.items.map((n: { type: string }) => n.type),
    ).toEqual(['group_invite']);
  });

  it('rejects an unknown filter', async () => {
    const res = await request(app)
      .get('/api/notifications?filter=bogus')
      .set(bearer(marcus));
    expect(res.status).toBe(400);
  });

  it('only returns the caller own notifications', async () => {
    const res = await request(app).get('/api/notifications').set(bearer(ava));
    expect(res.body.items).toHaveLength(0);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401);
  });
});

describe('unread count and marking read', () => {
  it('returns the unread count', async () => {
    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set(bearer(marcus));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unreadCount: 2 });
    expect(
      (await request(app).get('/api/notifications/unread-count')).status,
    ).toBe(401);
  });

  it('marks one notification read', async () => {
    const list = await request(app)
      .get('/api/notifications')
      .set(bearer(marcus));
    const id = list.body.items[0].id;

    const res = await request(app)
      .patch(`/api/notifications/${id}/read`)
      .set(bearer(marcus));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id, isRead: true });

    const count = await request(app)
      .get('/api/notifications/unread-count')
      .set(bearer(marcus));
    expect(count.body.unreadCount).toBe(1);

    const after = await request(app)
      .get('/api/notifications')
      .set(bearer(marcus));
    expect(
      after.body.items.find((n: { id: number }) => n.id === id),
    ).toMatchObject({
      isRead: true,
      dot: 'transparent',
    });
  });

  it('cannot mark someone else notification, and returns 404 for unknown ids', async () => {
    const list = await request(app)
      .get('/api/notifications')
      .set(bearer(marcus));
    const id = list.body.items[0].id;

    expect(
      (
        await request(app)
          .patch(`/api/notifications/${id}/read`)
          .set(bearer(outsider))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch('/api/notifications/9999/read')
          .set(bearer(marcus))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch('/api/notifications/abc/read')
          .set(bearer(marcus))
      ).status,
    ).toBe(400);
    expect(
      (await request(app).patch(`/api/notifications/${id}/read`)).status,
    ).toBe(401);

    const count = await request(app)
      .get('/api/notifications/unread-count')
      .set(bearer(marcus));
    expect(count.body.unreadCount).toBe(2);
  });

  it('marks everything read for the caller only', async () => {
    const res = await request(app)
      .post('/api/notifications/mark-all-read')
      .set(bearer(marcus));
    expect(res.status).toBe(200);
    expect(res.body.markedReadCount).toBe(2);

    expect(
      (
        await request(app)
          .get('/api/notifications/unread-count')
          .set(bearer(marcus))
      ).body.unreadCount,
    ).toBe(0);
    expect(
      (
        await request(app)
          .get('/api/notifications/unread-count')
          .set(bearer(outsider))
      ).body.unreadCount,
    ).toBe(1);
    expect(
      (await request(app).post('/api/notifications/mark-all-read')).status,
    ).toBe(401);
  });
});
