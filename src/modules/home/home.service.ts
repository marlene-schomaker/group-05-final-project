import { sql } from 'kysely';
import { db } from '../../db/database.js';
import {
  formatClock,
  formatDurationShort,
  formatWeekday,
} from '../../utils/format.js';
import { GroupsService } from '../groups/groups.service.js';

export class HomeService {
  static async getDashboard(userId: number) {
    const groups = await GroupsService.listUserGroups(userId);

    const pendingInvites = await db
      .selectFrom('event_invites')
      .innerJoin('events', 'events.event_id', 'event_invites.event_id')
      .innerJoin('groups', 'groups.group_id', 'events.group_id')
      .innerJoin(
        'users as inviter',
        'inviter.user_id',
        'event_invites.invited_by',
      )
      .select([
        'events.event_id',
        'events.group_id',
        'events.name as event_name',
        'events.min_duration_minutes',
        'events.min_attendees',
        'groups.name as group_name',
        'inviter.name as inviter_name',
      ])
      .where('event_invites.user_id', '=', userId)
      .where('event_invites.response', '=', 'pending')
      .where('events.status', '!=', 'Cancelled')
      .orderBy('event_invites.created_at', 'desc')
      .execute();

    const invites = pendingInvites.map((inv) => ({
      id: inv.event_id,
      groupId: inv.group_id,
      name: inv.event_name,
      group: `${inv.group_name}, invited by ${inv.inviter_name}`,
      rule: `At least ${formatDurationShort(inv.min_duration_minutes)}, needs ${inv.min_attendees} people`,
      actionUrl: `/groups/${inv.group_id}/events/${inv.event_id}`,
    }));

    const memberEvents = db
      .selectFrom('events')
      .innerJoin('group_members', 'group_members.group_id', 'events.group_id')
      .select('events.event_id')
      .where('group_members.user_id', '=', userId);

    const upcomingEvents = await db
      .selectFrom('events')
      .innerJoin('groups', 'groups.group_id', 'events.group_id')
      .select([
        'events.event_id',
        'events.group_id',
        'events.name as event_name',
        'events.confirmed_start_time',
        'events.confirmed_end_time',
        'groups.name as group_name',
      ])
      .where('events.event_id', 'in', memberEvents)
      .where('events.status', '=', 'Confirmed')
      .where('events.confirmed_start_time', '>', new Date())
      .orderBy('events.confirmed_start_time', 'asc')
      .execute();

    const upcoming = upcomingEvents.map((u) => {
      const start = new Date(u.confirmed_start_time!);
      let meta = `${u.group_name}, ${formatClock(start)}`;
      if (u.confirmed_end_time)
        meta += ` to ${formatClock(new Date(u.confirmed_end_time))}`;

      return {
        id: u.event_id,
        groupId: u.group_id,
        dow: formatWeekday(start, 'short').toUpperCase(),
        day: String(start.getUTCDate()),
        name: u.event_name,
        meta,
      };
    });

    const groupInvites = await GroupsService.listPendingInvites(userId);

    const unread = await db
      .selectFrom('notifications')
      .select(sql<number>`count(*)`.as('count'))
      .where('user_id', '=', userId)
      .where('is_read', '=', false)
      .executeTakeFirst();

    return {
      groups,
      invites,
      groupInvites,
      upcoming,
      unreadNotificationsCount: Number(unread?.count ?? 0),
    };
  }
}
