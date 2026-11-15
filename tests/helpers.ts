import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/database.js';

export interface TestUser {
  id: number;
  email: string;
  token: string;
}

export async function registerUser(
  name: string,
  email: string,
): Promise<TestUser> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123' });
  if (res.status !== 201) {
    throw new Error(
      `register failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return { id: res.body.user.id, email, token: res.body.accessToken };
}

export const bearer = (user: { token: string }) => ({
  Authorization: `Bearer ${user.token}`,
});

export async function createGroup(
  owner: TestUser,
  body: Record<string, unknown> = {},
) {
  const res = await request(app)
    .post('/api/groups')
    .set(bearer(owner))
    .send({ name: 'Study Crew', color: 'blue', ...body });
  if (res.status !== 201) {
    throw new Error(
      `createGroup failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return res.body as { id: number };
}

export async function addMember(
  groupId: number,
  user: TestUser,
  role: 'Admin' | 'Member' = 'Member',
) {
  await db
    .insertInto('group_members')
    .values({ group_id: groupId, user_id: user.id, role })
    .execute();
}

export async function createEvent(
  creator: TestUser,
  groupId: number,
  body: Record<string, unknown> = {},
) {
  const res = await request(app)
    .post(`/api/groups/${groupId}/events`)
    .set(bearer(creator))
    .send({
      name: 'Saturday study session',
      minDurationMinutes: 120,
      minAttendees: 2,
      inviteEmails: ['guest@example.com'],
      ...body,
    });
  if (res.status !== 201) {
    throw new Error(
      `createEvent failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return res.body as { id: number };
}

export const slot = (
  startTime: string,
  endTime: string,
  date = '2099-03-14',
) => ({
  date,
  startTime,
  endTime,
});
