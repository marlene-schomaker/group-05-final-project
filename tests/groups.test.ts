import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/database.js';
import { setupTestDb } from './setup.js';
import {
  addMember,
  bearer,
  createGroup,
  registerUser,
  type TestUser,
} from './helpers.js';

let ava: TestUser;
let marcus: TestUser;
let outsider: TestUser;
let groupId: number;

beforeEach(async () => {
  await setupTestDb();
  ava = await registerUser('Ava', 'ava@example.com');
  marcus = await registerUser('Marcus', 'marcus@example.com');
  outsider = await registerUser('Outsider', 'outsider@example.com');
  groupId = (await createGroup(ava, { description: 'Study sessions' })).id;
  await addMember(groupId, marcus);
});

describe('POST /api/groups', () => {
  it('creates a group and makes the creator an Admin', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set(bearer(ava))
      .send({ name: 'Book Club', color: 'pink' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Book Club',
      initial: 'B',
      color: 'pink',
      role: 'Admin',
      membersCount: 1,
    });
  });

  it('creates pending invites for optional emails instead of adding members', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set(bearer(ava))
      .send({
        name: 'Hack Night',
        inviteEmails: [
          'Outsider@example.com',
          'outsider@example.com',
          'new@example.com',
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.invited.sort()).toEqual([
      'new@example.com',
      'outsider@example.com',
    ]);

    const members = await db
      .selectFrom('group_members')
      .selectAll()
      .where('group_id', '=', res.body.id)
      .execute();
    expect(members).toHaveLength(1);
    const outbox = await db.selectFrom('email_outbox').selectAll().execute();
    expect(outbox.map((o) => o.to_email)).toEqual(['new@example.com']);
  });

  it('validates name and color', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set(bearer(ava))
      .send({ name: '   ', color: 'red' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/groups').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/groups', () => {
  it('lists only the groups the user belongs to, with the home card fields', async () => {
    await createGroup(outsider, { name: 'Private' });
    const res = await request(app).get('/api/groups').set(bearer(marcus));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      name: 'Study Crew',
      initial: 'S',
      membersLabel: '2 members',
      next: 'No events yet',
      role: 'Member',
    });
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/groups')).status).toBe(401);
  });
});

describe('GET /api/groups/:id', () => {
  it('returns members and events to a member', async () => {
    const res = await request(app)
      .get(`/api/groups/${groupId}`)
      .set(bearer(marcus));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Study Crew');
    expect(
      res.body.members.map((m: { name: string }) => m.name).sort(),
    ).toEqual(['Ava', 'You']);
    expect(
      res.body.members.find((m: { name: string }) => m.name === 'Ava').role,
    ).toBe('Admin');
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('returns 403 to a non-member', async () => {
    const res = await request(app)
      .get(`/api/groups/${groupId}`)
      .set(bearer(outsider));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for an unknown group and 400 for a bad id', async () => {
    expect(
      (await request(app).get('/api/groups/9999').set(bearer(ava))).status,
    ).toBe(404);
    expect(
      (await request(app).get('/api/groups/abc').set(bearer(ava))).status,
    ).toBe(400);
  });

  it('requires authentication', async () => {
    expect((await request(app).get(`/api/groups/${groupId}`)).status).toBe(401);
  });
});

describe('PUT and DELETE /api/groups/:id', () => {
  it('lets an admin update the group', async () => {
    const res = await request(app)
      .put(`/api/groups/${groupId}`)
      .set(bearer(ava))
      .send({ name: 'Study Crew 2', color: 'green' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Study Crew 2', color: 'green' });
  });

  it('forbids a plain member from updating or deleting', async () => {
    const put = await request(app)
      .put(`/api/groups/${groupId}`)
      .set(bearer(marcus))
      .send({ name: 'Hacked' });
    const del = await request(app)
      .delete(`/api/groups/${groupId}`)
      .set(bearer(marcus));

    expect(put.status).toBe(403);
    expect(del.status).toBe(403);
  });

  it('validates updates', async () => {
    const res = await request(app)
      .put(`/api/groups/${groupId}`)
      .set(bearer(ava))
      .send({ color: 'red' });
    expect(res.status).toBe(400);
  });

  it('lets an admin delete the group', async () => {
    const res = await request(app)
      .delete(`/api/groups/${groupId}`)
      .set(bearer(ava));
    expect(res.status).toBe(200);
    expect(
      (await request(app).get(`/api/groups/${groupId}`).set(bearer(ava)))
        .status,
    ).toBe(404);
  });
});

describe('group invitations', () => {
  it('notifies an existing user, who must accept before becoming a member', async () => {
    const res = await request(app)
      .post(`/api/groups/${groupId}/invites`)
      .set(bearer(marcus))
      .send({ emails: ['outsider@example.com', 'OUTSIDER@example.com'] });

    expect(res.status).toBe(200);
    expect(res.body.invited).toEqual(['outsider@example.com']);

    expect(
      (await request(app).get(`/api/groups/${groupId}`).set(bearer(outsider)))
        .status,
    ).toBe(403);

    const notes = await request(app)
      .get('/api/notifications?filter=invites')
      .set(bearer(outsider));
    expect(notes.body.items).toHaveLength(1);
    expect(notes.body.items[0].title).toBe(
      'Marcus invited you to join Study Crew',
    );

    const pending = await request(app)
      .get('/api/group-invites')
      .set(bearer(outsider));
    expect(pending.body).toHaveLength(1);

    const accept = await request(app)
      .post(`/api/group-invites/${pending.body[0].id}/accept`)
      .set(bearer(outsider));
    expect(accept.status).toBe(200);
    expect(accept.body.status).toBe('accepted');

    expect(
      (await request(app).get(`/api/groups/${groupId}`).set(bearer(outsider)))
        .status,
    ).toBe(200);

    const inviterNotes = await request(app)
      .get('/api/notifications')
      .set(bearer(marcus));
    expect(inviterNotes.body.items[0].title).toBe('Outsider joined Study Crew');
  });

  it('reports people who are already members or already invited', async () => {
    const first = await request(app)
      .post(`/api/groups/${groupId}/invites`)
      .set(bearer(ava))
      .send({ emails: ['outsider@example.com'] });
    expect(first.body.invited).toHaveLength(1);

    const second = await request(app)
      .post(`/api/groups/${groupId}/invites`)
      .set(bearer(ava))
      .send({ emails: ['outsider@example.com', 'marcus@example.com'] });
    expect(second.body).toMatchObject({
      invited: [],
      alreadyInvited: ['outsider@example.com'],
      alreadyMembers: ['marcus@example.com'],
    });
  });

  it('queues an email for someone without an account', async () => {
    await request(app)
      .post(`/api/groups/${groupId}/invites`)
      .set(bearer(ava))
      .send({ emails: ['nobody@example.com'] });

    const outbox = await db.selectFrom('email_outbox').selectAll().execute();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to_email).toBe('nobody@example.com');
  });

  it('lets an invitee decline, and blocks double responses', async () => {
    await request(app)
      .post(`/api/groups/${groupId}/invites`)
      .set(bearer(ava))
      .send({ emails: ['outsider@example.com'] });
    const [invite] = (
      await request(app).get('/api/group-invites').set(bearer(outsider))
    ).body;

    const decline = await request(app)
      .post(`/api/group-invites/${invite.id}/decline`)
      .set(bearer(outsider));
    expect(decline.status).toBe(200);

    const again = await request(app)
      .post(`/api/group-invites/${invite.id}/accept`)
      .set(bearer(outsider));
    expect(again.status).toBe(409);
  });

  it('hides invitations addressed to someone else', async () => {
    await request(app)
      .post(`/api/groups/${groupId}/invites`)
      .set(bearer(ava))
      .send({ emails: ['outsider@example.com'] });
    const [invite] = (
      await request(app).get('/api/group-invites').set(bearer(outsider))
    ).body;

    const res = await request(app)
      .post(`/api/group-invites/${invite.id}/accept`)
      .set(bearer(marcus));
    expect(res.status).toBe(404);
  });

  it('forbids non-members from inviting and validates emails', async () => {
    const forbidden = await request(app)
      .post(`/api/groups/${groupId}/invites`)
      .set(bearer(outsider))
      .send({ emails: ['x@example.com'] });
    expect(forbidden.status).toBe(403);

    const invalid = await request(app)
      .post(`/api/groups/${groupId}/invites`)
      .set(bearer(ava))
      .send({ emails: ['not-an-email'] });
    expect(invalid.status).toBe(400);

    const anon = await request(app)
      .post(`/api/groups/${groupId}/invites`)
      .send({ emails: ['x@example.com'] });
    expect(anon.status).toBe(401);
    expect((await request(app).get('/api/group-invites')).status).toBe(401);
  });
});

describe('membership management', () => {
  it('lets a member leave', async () => {
    const res = await request(app)
      .delete(`/api/groups/${groupId}/members/${marcus.id}`)
      .set(bearer(marcus));
    expect(res.status).toBe(200);
    expect(
      (await request(app).get(`/api/groups/${groupId}`).set(bearer(marcus)))
        .status,
    ).toBe(403);
  });

  it('lets an admin remove a member but not a plain member remove others', async () => {
    const denied = await request(app)
      .delete(`/api/groups/${groupId}/members/${ava.id}`)
      .set(bearer(marcus));
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .delete(`/api/groups/${groupId}/members/${marcus.id}`)
      .set(bearer(ava));
    expect(ok.status).toBe(200);
  });

  it('refuses to remove the last admin', async () => {
    const res = await request(app)
      .delete(`/api/groups/${groupId}/members/${ava.id}`)
      .set(bearer(ava));
    expect(res.status).toBe(409);
  });

  it('changes roles (admin only) and keeps at least one admin', async () => {
    const promote = await request(app)
      .patch(`/api/groups/${groupId}/members/${marcus.id}`)
      .set(bearer(ava))
      .send({ role: 'Admin' });
    expect(promote.status).toBe(200);
    expect(promote.body.role).toBe('Admin');

    const denied = await request(app)
      .patch(`/api/groups/${groupId}/members/${ava.id}`)
      .set(bearer(outsider))
      .send({ role: 'Member' });
    expect(denied.status).toBe(403);

    const bad = await request(app)
      .patch(`/api/groups/${groupId}/members/${marcus.id}`)
      .set(bearer(ava))
      .send({ role: 'Owner' });
    expect(bad.status).toBe(400);

    await request(app)
      .patch(`/api/groups/${groupId}/members/${marcus.id}`)
      .set(bearer(ava))
      .send({ role: 'Member' });
    const last = await request(app)
      .patch(`/api/groups/${groupId}/members/${ava.id}`)
      .set(bearer(ava))
      .send({ role: 'Member' });
    expect(last.status).toBe(409);
  });
});
