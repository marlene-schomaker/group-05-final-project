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
  slot,
  type TestUser,
} from './helpers.js';

let ava: TestUser;
let marcus: TestUser;
let priya: TestUser;
let outsider: TestUser;
let groupId: number;

beforeEach(async () => {
  await setupTestDb();
  ava = await registerUser('Ava', 'ava@example.com');
  marcus = await registerUser('Marcus', 'marcus@example.com');
  priya = await registerUser('Priya', 'priya@example.com');
  outsider = await registerUser('Outsider', 'outsider@example.com');
  groupId = (await createGroup(ava)).id;
  await addMember(groupId, marcus);
});

const availability = (eventId: number, user: TestUser, slots: unknown[]) =>
  request(app)
    .post(`/api/events/${eventId}/availability`)
    .set(bearer(user))
    .send({ slots });

describe('POST /api/groups/:groupId/events', () => {
  it('creates an event, dedupes emails, and notifies invited users', async () => {
    const res = await request(app)
      .post(`/api/groups/${groupId}/events`)
      .set(bearer(ava))
      .send({
        name: '  Saturday study session  ',
        minDurationMinutes: 120,
        minAttendees: 3,
        inviteEmails: [
          'marcus@example.com',
          'MARCUS@example.com',
          'priya@example.com',
          'ava@example.com',
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Saturday study session',
      status: 'Waiting for people',
      invitedCount: 2,
    });

    const invites = await db.selectFrom('event_invites').selectAll().execute();
    expect(invites).toHaveLength(2);
    expect(invites.every((i) => i.user_id !== null)).toBe(true);

    for (const user of [marcus, priya]) {
      const notes = await request(app)
        .get('/api/notifications')
        .set(bearer(user));
      expect(notes.body.items).toHaveLength(1);
      expect(notes.body.items[0]).toMatchObject({
        type: 'event_invite',
        title: 'Ava invited you to Saturday study session',
        action: 'Pick your times',
      });
      expect(notes.body.items[0].body).toContain(
        'Needs 3 people free for at least 2 hours',
      );
    }
  });

  it('stores invites for people without an account and emails them', async () => {
    await createEvent(ava, groupId, { inviteEmails: ['stranger@example.com'] });

    const invite = await db
      .selectFrom('event_invites')
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(invite.user_id).toBeNull();
    const outbox = await db.selectFrom('email_outbox').selectAll().execute();
    expect(outbox.map((o) => o.to_email)).toEqual(['stranger@example.com']);
  });

  it('respects the invitee notification preference', async () => {
    await request(app)
      .put('/api/account/preferences')
      .set(bearer(marcus))
      .send({ prefInvites: false });
    await createEvent(ava, groupId, { inviteEmails: ['marcus@example.com'] });

    const notes = await request(app)
      .get('/api/notifications')
      .set(bearer(marcus));
    expect(notes.body.items).toHaveLength(0);
  });

  it.each([
    ['a missing name', { name: '' }],
    ['a zero duration', { minDurationMinutes: 0 }],
    ['a negative duration', { minDurationMinutes: -30 }],
    ['a fractional duration', { minDurationMinutes: 45.5 }],
    ['zero attendees', { minAttendees: 0 }],
    ['fractional attendees', { minAttendees: 2.5 }],
    ['too many attendees', { minAttendees: 51 }],
    ['an invalid invite email', { inviteEmails: ['not-an-email'] }],
  ])('rejects %s', async (_label, override) => {
    const res = await request(app)
      .post(`/api/groups/${groupId}/events`)
      .set(bearer(ava))
      .send({
        name: 'Event',
        minDurationMinutes: 60,
        minAttendees: 1,
        inviteEmails: [],
        ...override,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a minimum that can never be reached with the people invited', async () => {
    const res = await request(app)
      .post(`/api/groups/${groupId}/events`)
      .set(bearer(ava))
      .send({
        name: 'Event',
        minDurationMinutes: 60,
        minAttendees: 5,
        inviteEmails: ['marcus@example.com'],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lets any group member create an event', async () => {
    const res = await request(app)
      .post(`/api/groups/${groupId}/events`)
      .set(bearer(marcus))
      .send({ name: 'Marcus event', minDurationMinutes: 60, minAttendees: 1 });
    expect(res.status).toBe(201);
  });

  it('forbids non-members and unauthenticated users', async () => {
    const body = { name: 'Event', minDurationMinutes: 60, minAttendees: 1 };
    const forbidden = await request(app)
      .post(`/api/groups/${groupId}/events`)
      .set(bearer(outsider))
      .send(body);
    expect(forbidden.status).toBe(403);

    const anon = await request(app)
      .post(`/api/groups/${groupId}/events`)
      .send(body);
    expect(anon.status).toBe(401);
  });
});

describe('GET /api/groups/:groupId/events and /api/events/:id', () => {
  it('lists events with the card fields for members', async () => {
    await createEvent(ava, groupId, {
      inviteEmails: ['marcus@example.com', 'priya@example.com'],
      minAttendees: 3,
      minDurationMinutes: 90,
    });

    const res = await request(app)
      .get(`/api/groups/${groupId}/events`)
      .set(bearer(marcus));
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      name: 'Saturday study session',
      status: 'Needs your reply',
      duration: 'At least 90 minutes',
      people: 'Needs 3 people',
      progress: '1 of 3 said yes',
      pct: '33%',
    });
  });

  it('hides the event list from non-members', async () => {
    expect(
      (
        await request(app)
          .get(`/api/groups/${groupId}/events`)
          .set(bearer(outsider))
      ).status,
    ).toBe(403);
    expect(
      (await request(app).get(`/api/groups/${groupId}/events`)).status,
    ).toBe(401);
  });

  it('shows event details to the creator, an invitee outside the group, and group members', async () => {
    const event = await createEvent(ava, groupId, {
      inviteEmails: ['priya@example.com'],
      minAttendees: 2,
    });

    for (const user of [ava, priya, marcus]) {
      const res = await request(app)
        .get(`/api/events/${event.id}`)
        .set(bearer(user));
      expect(res.status).toBe(200);
      expect(res.body.groupName).toBe('Study Crew');
    }

    const asPriya = await request(app)
      .get(`/api/events/${event.id}`)
      .set(bearer(priya));
    expect(asPriya.body.myResponse).toBe('pending');
    expect(asPriya.body.invites[0]).toMatchObject({
      email: 'priya@example.com',
      isYou: true,
    });
  });

  it('forbids people with no connection to the event, and requires auth', async () => {
    const event = await createEvent(ava, groupId);
    expect(
      (await request(app).get(`/api/events/${event.id}`).set(bearer(outsider)))
        .status,
    ).toBe(403);
    expect((await request(app).get(`/api/events/${event.id}`)).status).toBe(
      401,
    );
    expect(
      (await request(app).get('/api/events/9999').set(bearer(ava))).status,
    ).toBe(404);
  });
});

describe('responding and availability', () => {
  it('records yes and no responses from invitees only', async () => {
    const event = await createEvent(ava, groupId, {
      inviteEmails: ['priya@example.com'],
      minAttendees: 2,
    });

    const yes = await request(app)
      .put(`/api/events/${event.id}/respond`)
      .set(bearer(priya))
      .send({ response: 'yes' });
    expect(yes.status).toBe(200);
    const detail = await request(app)
      .get(`/api/events/${event.id}`)
      .set(bearer(priya));
    expect(detail.body.myResponse).toBe('yes');
    expect(detail.body.progress).toBe('2 of 2 said yes');

    const notInvited = await request(app)
      .put(`/api/events/${event.id}/respond`)
      .set(bearer(marcus))
      .send({ response: 'yes' });
    expect(notInvited.status).toBe(404);
    const stranger = await request(app)
      .put(`/api/events/${event.id}/respond`)
      .set(bearer(outsider))
      .send({ response: 'yes' });
    expect(stranger.status).toBe(403);
    const anon = await request(app)
      .put(`/api/events/${event.id}/respond`)
      .send({ response: 'yes' });
    expect(anon.status).toBe(401);
  });

  it('validates the response value', async () => {
    const event = await createEvent(ava, groupId, {
      inviteEmails: ['priya@example.com'],
      minAttendees: 2,
    });
    const res = await request(app)
      .put(`/api/events/${event.id}/respond`)
      .set(bearer(priya))
      .send({ response: 'maybe' });
    expect(res.status).toBe(400);
  });

  it('validates availability slots', async () => {
    const event = await createEvent(ava, groupId, {
      inviteEmails: ['priya@example.com'],
      minAttendees: 2,
    });

    const reversed = await availability(event.id, priya, [
      slot('12:00', '10:00'),
    ]);
    expect(reversed.status).toBe(400);
    const badDate = await availability(event.id, priya, [
      { date: '14/03/2099', startTime: '10:00', endTime: '11:00' },
    ]);
    expect(badDate.status).toBe(400);
    const empty = await availability(event.id, priya, []);
    expect(empty.status).toBe(400);
  });

  it('only lets the creator and invitees share availability', async () => {
    const event = await createEvent(ava, groupId, {
      inviteEmails: ['priya@example.com'],
      minAttendees: 2,
    });
    expect(
      (await availability(event.id, outsider, [slot('10:00', '12:00')])).status,
    ).toBe(403);
    expect(
      (await availability(event.id, marcus, [slot('10:00', '12:00')])).status,
    ).toBe(403);
    const anon = await request(app)
      .post(`/api/events/${event.id}/availability`)
      .send({ slots: [slot('10:00', '12:00')] });
    expect(anon.status).toBe(401);
  });

  it('confirms the event only when enough people overlap for the minimum time', async () => {
    const event = await createEvent(ava, groupId, {
      inviteEmails: ['marcus@example.com', 'priya@example.com'],
      minAttendees: 3,
      minDurationMinutes: 120,
    });

    await availability(event.id, ava, [slot('10:00', '14:00')]);
    await availability(event.id, marcus, [slot('12:00', '16:00')]);
    const short = await availability(event.id, priya, [slot('13:00', '14:00')]);
    expect(short.body.status).toBe('Waiting for people');

    const ok = await availability(event.id, priya, [slot('12:00', '15:00')]);
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('Confirmed');
    expect(new Date(ok.body.confirmedStartTime).toISOString()).toBe(
      '2099-03-14T12:00:00.000Z',
    );
    expect(new Date(ok.body.confirmedEndTime).toISOString()).toBe(
      '2099-03-14T14:00:00.000Z',
    );

    for (const user of [ava, marcus, priya]) {
      const notes = await request(app)
        .get('/api/notifications?filter=updates')
        .set(bearer(user));
      expect(notes.body.items).toHaveLength(1);
      expect(notes.body.items[0].type).toBe('event_confirmed');
    }

    const detail = await request(app)
      .get(`/api/events/${event.id}`)
      .set(bearer(marcus));
    expect(detail.body.status).toBe('Confirmed');
  });

  it('does not confirm when people say yes but their times do not overlap', async () => {
    const event = await createEvent(ava, groupId, {
      inviteEmails: ['priya@example.com'],
      minAttendees: 2,
      minDurationMinutes: 60,
    });
    await availability(event.id, ava, [slot('09:00', '10:00')]);
    const res = await availability(event.id, priya, [slot('11:00', '12:00')]);
    expect(res.body.status).toBe('Waiting for people');
  });

  it('moves a confirmed event back to waiting when someone withdraws', async () => {
    const event = await createEvent(ava, groupId, {
      inviteEmails: ['priya@example.com'],
      minAttendees: 2,
      minDurationMinutes: 60,
    });
    await availability(event.id, ava, [slot('10:00', '12:00')]);
    const confirmed = await availability(event.id, priya, [
      slot('10:00', '12:00'),
    ]);
    expect(confirmed.body.status).toBe('Confirmed');

    await request(app)
      .put(`/api/events/${event.id}/respond`)
      .set(bearer(priya))
      .send({ response: 'no' });

    const detail = await request(app)
      .get(`/api/events/${event.id}`)
      .set(bearer(ava));
    expect(detail.body.status).toBe('Waiting for people');
    expect(detail.body.confirmedStartTime).toBeNull();

    const notes = await request(app)
      .get('/api/notifications?filter=updates')
      .set(bearer(ava));
    expect(notes.body.items.map((n: { type: string }) => n.type)).toContain(
      'event_status',
    );
  });

  it('returns the caller availability and the current overlap', async () => {
    const event = await createEvent(ava, groupId, {
      inviteEmails: ['priya@example.com'],
      minAttendees: 2,
      minDurationMinutes: 60,
    });
    await availability(event.id, ava, [
      slot('10:00', '12:00'),
      slot('10:00', '12:00'),
    ]);
    await availability(event.id, priya, [slot('11:00', '13:00')]);

    const res = await request(app)
      .get(`/api/events/${event.id}/availability`)
      .set(bearer(ava));
    expect(res.status).toBe(200);
    expect(res.body.slots).toEqual([
      { date: '2099-03-14', startTime: '10:00:00', endTime: '12:00:00' },
    ]);
    expect(new Date(res.body.overlap.start).toISOString()).toBe(
      '2099-03-14T11:00:00.000Z',
    );

    expect(
      (
        await request(app)
          .get(`/api/events/${event.id}/availability`)
          .set(bearer(outsider))
      ).status,
    ).toBe(403);
    expect(
      (await request(app).get(`/api/events/${event.id}/availability`)).status,
    ).toBe(401);
  });
});

describe('DELETE /api/events/:id (cancel)', () => {
  it('lets the creator cancel and notifies invitees', async () => {
    const event = await createEvent(ava, groupId, {
      inviteEmails: ['priya@example.com'],
      minAttendees: 2,
    });

    const res = await request(app)
      .delete(`/api/events/${event.id}`)
      .set(bearer(ava));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Cancelled');

    const notes = await request(app)
      .get('/api/notifications?filter=updates')
      .set(bearer(priya));
    expect(notes.body.items[0].title).toBe(
      'Saturday study session was cancelled',
    );

    const respond = await request(app)
      .put(`/api/events/${event.id}/respond`)
      .set(bearer(priya))
      .send({ response: 'yes' });
    expect(respond.status).toBe(409);
    const again = await request(app)
      .delete(`/api/events/${event.id}`)
      .set(bearer(ava));
    expect(again.status).toBe(409);
  });

  it('lets a group admin cancel someone else event but not a plain member', async () => {
    const event = await createEvent(marcus, groupId, {
      inviteEmails: ['priya@example.com'],
      minAttendees: 2,
    });

    const byMember = await request(app)
      .delete(`/api/events/${event.id}`)
      .set(bearer(priya));
    expect(byMember.status).toBe(403);
    const byAdmin = await request(app)
      .delete(`/api/events/${event.id}`)
      .set(bearer(ava));
    expect(byAdmin.status).toBe(200);
  });

  it('requires authentication and access', async () => {
    const event = await createEvent(ava, groupId);
    expect((await request(app).delete(`/api/events/${event.id}`)).status).toBe(
      401,
    );
    expect(
      (
        await request(app)
          .delete(`/api/events/${event.id}`)
          .set(bearer(outsider))
      ).status,
    ).toBe(403);
  });
});
