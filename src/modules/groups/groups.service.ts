import { sql, type Kysely } from 'kysely';
import { db } from '../../db/database.js';
import type { Database } from '../../db/types.js';
import { AppError } from '../../middleware/error-handler.js';
import {
  colorsFor,
  formatClock,
  formatWeekday,
  initialOf,
  normalizeEmails,
  pluralize,
} from '../../utils/format.js';
import { queueEmail } from '../mailer/mailer.service.js';
import { notifyUser } from '../notifications/notifications.dispatch.js';
import { summarizeEvents } from '../events/events.service.js';

type Executor = Kysely<Database>;
type GroupColor = 'blue' | 'green' | 'amber' | 'pink' | 'violet';

export class GroupsService {
  static async listUserGroups(userId: number) {
    const groups = await db
      .selectFrom('group_members')
      .innerJoin('groups', 'groups.group_id', 'group_members.group_id')
      .selectAll('groups')
      .select(['group_members.role'])
      .where('group_members.user_id', '=', userId)
      .orderBy('groups.created_at', 'asc')
      .execute();

    if (groups.length === 0) return [];
    const groupIds = groups.map((g) => g.group_id);

    const counts = await db
      .selectFrom('group_members')
      .select(['group_id', sql<number>`count(*)`.as('count')])
      .where('group_id', 'in', groupIds)
      .groupBy('group_id')
      .execute();
    const countByGroup = new Map(
      counts.map((c) => [c.group_id, Number(c.count)]),
    );

    const events = await db
      .selectFrom('events')
      .select(['group_id', 'status', 'confirmed_start_time'])
      .where('group_id', 'in', groupIds)
      .where('status', '!=', 'Cancelled')
      .execute();

    const now = Date.now();
    return groups.map((g) => {
      const memberCount = countByGroup.get(g.group_id) ?? 1;
      const groupEvents = events.filter((e) => e.group_id === g.group_id);

      const upcoming = groupEvents
        .filter(
          (e) =>
            e.status === 'Confirmed' &&
            e.confirmed_start_time &&
            new Date(e.confirmed_start_time).getTime() > now,
        )
        .sort(
          (a, b) =>
            new Date(a.confirmed_start_time!).getTime() -
            new Date(b.confirmed_start_time!).getTime(),
        )[0];

      let next = 'No events yet';
      if (upcoming?.confirmed_start_time) {
        const d = new Date(upcoming.confirmed_start_time);
        next = `Next: ${formatWeekday(d, 'short')} ${formatClock(d)}`;
      } else {
        const waiting = groupEvents.filter(
          (e) => e.status !== 'Confirmed',
        ).length;
        if (waiting > 0)
          next = `${pluralize(waiting, 'event')} waiting for people`;
      }

      const colors = colorsFor(g.color);
      return {
        id: g.group_id,
        name: g.name,
        description: g.description,
        initial: initialOf(g.name),
        membersLabel: pluralize(memberCount, 'member'),
        memberCount,
        next,
        bg: colors.bg,
        fg: colors.fg,
        color: g.color,
        role: g.role,
      };
    });
  }

  static async createGroup(
    userId: number,
    data: {
      name: string;
      description?: string;
      color: GroupColor;
      inviteEmails?: string[];
    },
  ) {
    return db.transaction().execute(async (trx) => {
      const creator = await trx
        .selectFrom('users')
        .selectAll()
        .where('user_id', '=', userId)
        .executeTakeFirstOrThrow();

      const group = await trx
        .insertInto('groups')
        .values({
          name: data.name.trim(),
          description: data.description?.trim() || null,
          color: data.color || 'blue',
          created_by: userId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('group_members')
        .values({ group_id: group.group_id, user_id: userId, role: 'Admin' })
        .execute();

      const invites = await GroupsService.createInvites(
        trx,
        group,
        creator,
        data.inviteEmails ?? [],
      );

      const colors = colorsFor(group.color);
      return {
        id: group.group_id,
        name: group.name,
        description: group.description,
        color: group.color,
        initial: initialOf(group.name),
        bg: colors.bg,
        fg: colors.fg,
        membersCount: 1,
        role: 'Admin',
        invited: invites.invited,
      };
    });
  }

  static async getGroupDetails(groupId: number, currentUserId: number) {
    const group = await db
      .selectFrom('groups')
      .selectAll()
      .where('group_id', '=', groupId)
      .executeTakeFirst();
    if (!group) throw new AppError('Group not found', 404);

    const members = await db
      .selectFrom('group_members')
      .innerJoin('users', 'users.user_id', 'group_members.user_id')
      .select([
        'users.user_id',
        'users.name',
        'users.email',
        'users.avatar_color',
        'group_members.role',
      ])
      .where('group_members.group_id', '=', groupId)
      .orderBy('group_members.created_at', 'asc')
      .execute();

    const formattedMembers = members.map((m) => {
      const isYou = m.user_id === currentUserId;
      const colors = colorsFor(m.avatar_color);
      return {
        id: m.user_id,
        name: isYou ? 'You' : m.name,
        displayName: m.name,
        email: m.email,
        role: m.role,
        initial: isYou ? 'Y' : initialOf(m.name),
        bg: isYou ? '#EAECF0' : colors.bg,
        fg: isYou ? '#344054' : colors.fg,
      };
    });

    const events = await db
      .selectFrom('events')
      .selectAll()
      .where('group_id', '=', groupId)
      .orderBy('created_at', 'desc')
      .execute();

    const colors = colorsFor(group.color);
    const me = members.find((m) => m.user_id === currentUserId);
    return {
      id: group.group_id,
      name: group.name,
      description: group.description,
      initial: initialOf(group.name),
      membersLabel: pluralize(members.length, 'member'),
      bg: colors.bg,
      fg: colors.fg,
      color: group.color,
      role: me?.role,
      members: formattedMembers,
      events: await summarizeEvents(db, events, currentUserId),
    };
  }

  static async updateGroup(
    groupId: number,
    data: { name?: string; description?: string; color?: GroupColor },
  ) {
    return db
      .updateTable('groups')
      .set({
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description.trim() }
          : {}),
        ...(data.color ? { color: data.color } : {}),
        updated_at: new Date(),
      })
      .where('group_id', '=', groupId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  static async deleteGroup(groupId: number) {
    await db.deleteFrom('groups').where('group_id', '=', groupId).execute();
    return { message: 'Group deleted successfully' };
  }

  static async inviteMembers(
    groupId: number,
    inviterId: number,
    emails: string[],
  ) {
    return db.transaction().execute(async (trx) => {
      const group = await trx
        .selectFrom('groups')
        .selectAll()
        .where('group_id', '=', groupId)
        .executeTakeFirst();
      if (!group) throw new AppError('Group not found', 404);

      const inviter = await trx
        .selectFrom('users')
        .selectAll()
        .where('user_id', '=', inviterId)
        .executeTakeFirstOrThrow();

      return GroupsService.createInvites(trx, group, inviter, emails);
    });
  }

  private static async createInvites(
    trx: Executor,
    group: { group_id: number; name: string },
    inviter: { user_id: number; name: string; email: string },
    rawEmails: string[],
  ) {
    const emails = normalizeEmails(rawEmails, [inviter.email]);
    const invited: string[] = [];
    const alreadyMembers: string[] = [];
    const alreadyInvited: string[] = [];

    for (const email of emails) {
      const user = await trx
        .selectFrom('users')
        .select(['user_id'])
        .where('email', '=', email)
        .executeTakeFirst();

      if (user) {
        const member = await trx
          .selectFrom('group_members')
          .select('user_id')
          .where('group_id', '=', group.group_id)
          .where('user_id', '=', user.user_id)
          .executeTakeFirst();
        if (member) {
          alreadyMembers.push(email);
          continue;
        }
      }

      const existing = await trx
        .selectFrom('group_invites')
        .selectAll()
        .where('group_id', '=', group.group_id)
        .where('email', '=', email)
        .executeTakeFirst();

      if (existing?.status === 'pending') {
        alreadyInvited.push(email);
        continue;
      }

      let inviteId: number;
      if (existing) {
        await trx
          .updateTable('group_invites')
          .set({
            status: 'pending',
            user_id: user?.user_id ?? null,
            invited_by: inviter.user_id,
            updated_at: new Date(),
          })
          .where('invite_id', '=', existing.invite_id)
          .execute();
        inviteId = existing.invite_id;
      } else {
        const row = await trx
          .insertInto('group_invites')
          .values({
            group_id: group.group_id,
            email,
            user_id: user?.user_id ?? null,
            invited_by: inviter.user_id,
          })
          .returning('invite_id')
          .executeTakeFirstOrThrow();
        inviteId = row.invite_id;
      }

      const title = `${inviter.name} invited you to join ${group.name}`;
      if (user) {
        await notifyUser(trx, {
          userId: user.user_id,
          type: 'group_invite',
          title,
          body: `Accept to become a member of ${group.name}.`,
          icon: '@',
          actionLabel: 'View invite',
          actionUrl: `/group-invites/${inviteId}`,
          groupId: group.group_id,
        });
      } else {
        await queueEmail(
          trx,
          email,
          title,
          `${title}. Sign up with this email address to accept.`,
        );
      }

      invited.push(email);
    }

    return { invited, alreadyMembers, alreadyInvited };
  }

  private static async loadMembership(groupId: number, userId: number) {
    return db
      .selectFrom('group_members')
      .select(['role'])
      .where('group_id', '=', groupId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
  }

  private static async adminCount(groupId: number, executor: Executor = db) {
    const res = await executor
      .selectFrom('group_members')
      .select(sql<number>`count(*)`.as('count'))
      .where('group_id', '=', groupId)
      .where('role', '=', 'Admin')
      .executeTakeFirst();
    return Number(res?.count ?? 0);
  }

  static async removeMember(
    groupId: number,
    actorId: number,
    targetUserId: number,
  ) {
    const actor = await GroupsService.loadMembership(groupId, actorId);
    if (!actor) throw new AppError('You are not a member of this group', 403);

    if (actorId !== targetUserId && actor.role !== 'Admin') {
      throw new AppError('Admin access required to remove other members', 403);
    }

    const target = await GroupsService.loadMembership(groupId, targetUserId);
    if (!target) throw new AppError('Member not found in this group', 404);

    if (
      target.role === 'Admin' &&
      (await GroupsService.adminCount(groupId)) <= 1
    ) {
      throw new AppError(
        'The last admin cannot leave. Promote another member or delete the group.',
        409,
      );
    }

    await db
      .deleteFrom('group_members')
      .where('group_id', '=', groupId)
      .where('user_id', '=', targetUserId)
      .execute();

    return {
      message:
        actorId === targetUserId ? 'You left the group' : 'Member removed',
    };
  }

  static async updateMemberRole(
    groupId: number,
    targetUserId: number,
    role: 'Admin' | 'Member',
  ) {
    const target = await GroupsService.loadMembership(groupId, targetUserId);
    if (!target) throw new AppError('Member not found in this group', 404);

    if (
      target.role === 'Admin' &&
      role === 'Member' &&
      (await GroupsService.adminCount(groupId)) <= 1
    ) {
      throw new AppError('A group needs at least one admin', 409);
    }

    await db
      .updateTable('group_members')
      .set({ role })
      .where('group_id', '=', groupId)
      .where('user_id', '=', targetUserId)
      .execute();

    return { userId: targetUserId, role };
  }

  static async listPendingInvites(userId: number) {
    const rows = await db
      .selectFrom('group_invites')
      .innerJoin('groups', 'groups.group_id', 'group_invites.group_id')
      .innerJoin(
        'users as inviter',
        'inviter.user_id',
        'group_invites.invited_by',
      )
      .select([
        'group_invites.invite_id',
        'group_invites.group_id',
        'groups.name as group_name',
        'inviter.name as inviter_name',
        'group_invites.created_at',
      ])
      .where('group_invites.user_id', '=', userId)
      .where('group_invites.status', '=', 'pending')
      .orderBy('group_invites.created_at', 'desc')
      .execute();

    return rows.map((r) => ({
      id: r.invite_id,
      groupId: r.group_id,
      groupName: r.group_name,
      invitedBy: r.inviter_name,
      createdAt: r.created_at,
    }));
  }

  static async respondToGroupInvite(
    inviteId: number,
    userId: number,
    decision: 'accepted' | 'declined',
  ) {
    return db.transaction().execute(async (trx) => {
      const invite = await trx
        .selectFrom('group_invites')
        .selectAll()
        .where('invite_id', '=', inviteId)
        .executeTakeFirst();

      if (!invite || invite.user_id !== userId)
        throw new AppError('Invitation not found', 404);
      if (invite.status !== 'pending') {
        throw new AppError(`This invitation was already ${invite.status}`, 409);
      }

      await trx
        .updateTable('group_invites')
        .set({ status: decision, updated_at: new Date() })
        .where('invite_id', '=', inviteId)
        .execute();

      if (decision === 'accepted') {
        await trx
          .insertInto('group_members')
          .values({
            group_id: invite.group_id,
            user_id: userId,
            role: 'Member',
          })
          .onConflict((oc) => oc.doNothing())
          .execute();

        const group = await trx
          .selectFrom('groups')
          .select('name')
          .where('group_id', '=', invite.group_id)
          .executeTakeFirstOrThrow();
        const user = await trx
          .selectFrom('users')
          .select('name')
          .where('user_id', '=', userId)
          .executeTakeFirstOrThrow();

        await notifyUser(trx, {
          userId: invite.invited_by,
          type: 'member_joined',
          title: `${user.name} joined ${group.name}`,
          body: 'They accepted your invite.',
          icon: '+',
          actionLabel: 'View group',
          actionUrl: `/groups/${invite.group_id}`,
          groupId: invite.group_id,
        });
      }

      return { id: inviteId, groupId: invite.group_id, status: decision };
    });
  }
}
