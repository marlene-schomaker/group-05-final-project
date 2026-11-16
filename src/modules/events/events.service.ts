import type { Kysely } from 'kysely';
import { db } from '../../db/database.js';
import type { Database } from '../../db/types.js';
import { AppError } from '../../middleware/error-handler.js';
import {
  eventPill,
  formatClock,
  formatDuration,
  formatWeekday,
  normalizeEmails,
} from '../../utils/format.js';
import { queueEmail } from '../mailer/mailer.service.js';
import { notifyUser } from '../notifications/notifications.dispatch.js';
import {
  findOverlapWindow,
  normalizeTime,
  toDateString,
  type AvailabilityBlock,
} from './overlap.js';

type Executor = Kysely<Database>;

interface EventRecord {
  event_id: number;
  group_id: number;
  created_by: number;
  name: string;
  min_duration_minutes: number;
  min_attendees: number;
  status: 'Waiting for people' | 'Needs your reply' | 'Confirmed' | 'Cancelled';
  confirmed_start_time: Date | null;
  confirmed_end_time: Date | null;
}

interface InviteRecord {
  user_id: number | null;
  response: 'pending' | 'yes' | 'no';
}

export function summarizeEvent(
  e: EventRecord,
  invites: InviteRecord[],
  currentUserId: number,
) {
  const yesCount = 1 + invites.filter((i) => i.response === 'yes').length;
  const pct = Math.min(100, Math.round((yesCount / e.min_attendees) * 100));

  let status: string = e.status;
  const mine = invites.find((i) => i.user_id === currentUserId);
  if (
    mine &&
    mine.response === 'pending' &&
    e.status === 'Waiting for people'
  ) {
    status = 'Needs your reply';
  }

  return {
    id: e.event_id,
    groupId: e.group_id,
    name: e.name,
    status,
    ...eventPill(status),
    duration: `At least ${formatDuration(e.min_duration_minutes)}`,
    minDurationMinutes: e.min_duration_minutes,
    minAttendees: e.min_attendees,
    people: `Needs ${e.min_attendees} people`,
    pct: `${pct}%`,
    progress: `${yesCount} of ${e.min_attendees} said yes`,
    yesCount,
    confirmedStartTime: e.confirmed_start_time,
    confirmedEndTime: e.confirmed_end_time,
    invitesCount: invites.length,
  };
}

export async function summarizeEvents(
  executor: Executor,
  events: EventRecord[],
  currentUserId: number,
) {
  if (events.length === 0) return [];

  const invites = await executor
    .selectFrom('event_invites')
    .select(['event_id', 'user_id', 'response'])
    .where(
      'event_id',
      'in',
      events.map((e) => e.event_id),
    )
    .execute();

  const byEvent = new Map<number, InviteRecord[]>();
  for (const inv of invites) {
    const list = byEvent.get(inv.event_id) ?? [];
    list.push(inv);
    byEvent.set(inv.event_id, list);
  }

  return events.map((e) =>
    summarizeEvent(e, byEvent.get(e.event_id) ?? [], currentUserId),
  );
}

export class EventsService {
  static async listGroupEvents(groupId: number, currentUserId: number) {
    const events = await db
      .selectFrom('events')
      .selectAll()
      .where('group_id', '=', groupId)
      .orderBy('created_at', 'desc')
      .execute();

    return summarizeEvents(db, events, currentUserId);
  }

  static async createEvent(
    groupId: number,
    creatorId: number,
    data: {
      name: string;
      minDurationMinutes: number;
      minAttendees: number;
      inviteEmails?: string[];
    },
  ) {
    const group = await db
      .selectFrom('groups')
      .selectAll()
      .where('group_id', '=', groupId)
      .executeTakeFirst();
    if (!group) throw new AppError('Group not found', 404);

    const creator = await db
      .selectFrom('users')
      .selectAll()
      .where('user_id', '=', creatorId)
      .executeTakeFirst();
    if (!creator) throw new AppError('Creator not found', 404);

    const emails = normalizeEmails(data.inviteEmails ?? [], [creator.email]);

    if (data.minAttendees > emails.length + 1) {
      throw new AppError(
        'Minimum attendees cannot be more than the people invited plus you',
        400,
        [
          {
            field: 'minAttendees',
            message: `At most ${emails.length + 1} with the current invites`,
          },
        ],
        'VALIDATION_ERROR',
      );
    }

    return db.transaction().execute(async (trx) => {
      const event = await trx
        .insertInto('events')
        .values({
          group_id: groupId,
          created_by: creatorId,
          name: data.name.trim(),
          min_duration_minutes: data.minDurationMinutes,
          min_attendees: data.minAttendees,
          status: 'Waiting for people',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const title = `${creator.name} invited you to ${event.name}`;
      const body = `${group.name}. Needs ${event.min_attendees} people free for at least ${formatDuration(event.min_duration_minutes)}. Pick the times you can make.`;

      for (const email of emails) {
        const matchedUser = await trx
          .selectFrom('users')
          .select(['user_id'])
          .where('email', '=', email)
          .executeTakeFirst();

        await trx
          .insertInto('event_invites')
          .values({
            event_id: event.event_id,
            email,
            user_id: matchedUser?.user_id ?? null,
            invited_by: creatorId,
            response: 'pending',
          })
          .execute();

        if (matchedUser) {
          await notifyUser(trx, {
            userId: matchedUser.user_id,
            type: 'event_invite',
            title,
            body,
            icon: '@',
            actionLabel: 'Pick your times',
            actionUrl: `/groups/${groupId}/events/${event.event_id}`,
            groupId,
            eventId: event.event_id,
          });
        } else {
          await queueEmail(
            trx,
            email,
            title,
            `${body} Sign up with this email address to reply.`,
          );
        }
      }

      return {
        id: event.event_id,
        groupId: event.group_id,
        name: event.name,
        minDurationMinutes: event.min_duration_minutes,
        minAttendees: event.min_attendees,
        status: event.status,
        invitedCount: emails.length,
      };
    });
  }

  static async loadEventForUser(
    eventId: number,
    userId: number,
    executor: Executor = db,
  ) {
    const event = await executor
      .selectFrom('events')
      .selectAll()
      .where('event_id', '=', eventId)
      .executeTakeFirst();
    if (!event) throw new AppError('Event not found', 404);

    const invite = await executor
      .selectFrom('event_invites')
      .selectAll()
      .where('event_id', '=', eventId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    const membership = await executor
      .selectFrom('group_members')
      .select('role')
      .where('group_id', '=', event.group_id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    const isCreator = event.created_by === userId;
    if (!isCreator && !invite && !membership) {
      throw new AppError('You do not have access to this event', 403);
    }

    return { event, invite, membership, isCreator };
  }

  private static assertParticipant(ctx: {
    invite?: unknown;
    isCreator: boolean;
  }) {
    if (!ctx.isCreator && !ctx.invite) {
      throw new AppError(
        'Only the creator and invited people can respond to this event',
        403,
      );
    }
  }

  private static assertOpen(event: EventRecord) {
    if (event.status === 'Cancelled') {
      throw new AppError('This event has been cancelled', 409);
    }
  }

  static async getEventById(eventId: number, currentUserId: number) {
    const { event, invite, isCreator } = await this.loadEventForUser(
      eventId,
      currentUserId,
    );

    const group = await db
      .selectFrom('groups')
      .select(['name'])
      .where('group_id', '=', event.group_id)
      .executeTakeFirst();

    const invites = await db
      .selectFrom('event_invites')
      .leftJoin('users', 'users.user_id', 'event_invites.user_id')
      .select([
        'event_invites.invite_id',
        'event_invites.email',
        'event_invites.response',
        'event_invites.user_id',
        'users.name as user_name',
      ])
      .where('event_invites.event_id', '=', eventId)
      .execute();

    const [summary] = await summarizeEvents(db, [event], currentUserId);

    return {
      ...summary,
      groupName: group?.name,
      isCreator,
      myResponse: isCreator ? 'yes' : (invite?.response ?? null),
      invites: invites.map((i) => ({
        id: i.invite_id,
        email: i.email,
        name: i.user_name || i.email.split('@')[0],
        response: i.response,
        isYou: i.user_id === currentUserId,
      })),
    };
  }

  static async respondToInvite(
    eventId: number,
    userId: number,
    response: 'yes' | 'no',
  ) {
    const ctx = await this.loadEventForUser(eventId, userId);
    this.assertOpen(ctx.event);
    if (!ctx.invite) {
      throw new AppError(
        ctx.isCreator
          ? 'The creator is automatically attending'
          : 'Invitation not found for this user',
        ctx.isCreator ? 409 : 404,
      );
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('event_invites')
        .set({ response, updated_at: new Date() })
        .where('invite_id', '=', ctx.invite!.invite_id)
        .execute();

      if (response === 'no') {
        await trx
          .deleteFrom('open_time_blocks')
          .where('event_id', '=', eventId)
          .where('user_id', '=', userId)
          .execute();
      }

      await EventsService.recomputeConfirmation(eventId, trx);
    });

    return { message: `Invitation response recorded: ${response}` };
  }

  static async submitAvailability(
    eventId: number,
    userId: number,
    slots: Array<{ date: string; startTime: string; endTime: string }>,
  ) {
    const ctx = await this.loadEventForUser(eventId, userId);
    this.assertParticipant(ctx);
    this.assertOpen(ctx.event);

    return db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('open_time_blocks')
        .where('event_id', '=', eventId)
        .where('user_id', '=', userId)
        .execute();

      const unique = new Map<string, (typeof slots)[number]>();
      for (const slot of slots) {
        unique.set(
          `${slot.date}|${normalizeTime(slot.startTime)}|${normalizeTime(slot.endTime)}`,
          slot,
        );
      }

      for (const slot of unique.values()) {
        await trx
          .insertInto('open_time_blocks')
          .values({
            event_id: eventId,
            user_id: userId,
            date: slot.date,
            start_time: normalizeTime(slot.startTime),
            end_time: normalizeTime(slot.endTime),
          })
          .execute();
      }

      if (ctx.invite) {
        await trx
          .updateTable('event_invites')
          .set({ response: 'yes', updated_at: new Date() })
          .where('invite_id', '=', ctx.invite.invite_id)
          .execute();
      }

      await EventsService.recomputeConfirmation(eventId, trx);

      const updated = await trx
        .selectFrom('events')
        .select(['status', 'confirmed_start_time', 'confirmed_end_time'])
        .where('event_id', '=', eventId)
        .executeTakeFirstOrThrow();

      return {
        message: 'Availability submitted successfully',
        slotsCount: unique.size,
        status: updated.status,
        confirmedStartTime: updated.confirmed_start_time,
        confirmedEndTime: updated.confirmed_end_time,
      };
    });
  }

  static async getAvailability(eventId: number, userId: number) {
    const ctx = await this.loadEventForUser(eventId, userId);

    const mine = await db
      .selectFrom('open_time_blocks')
      .select(['date', 'start_time', 'end_time'])
      .where('event_id', '=', eventId)
      .where('user_id', '=', userId)
      .orderBy('date')
      .orderBy('start_time')
      .execute();

    const window = await EventsService.currentWindow(eventId, ctx.event, db);

    return {
      slots: mine.map((m) => ({
        date: toDateString(m.date),
        startTime: normalizeTime(m.start_time),
        endTime: normalizeTime(m.end_time),
      })),
      overlap: window ? { start: window.start, end: window.end } : null,
      status: ctx.event.status,
    };
  }

  static async cancelEvent(eventId: number, userId: number) {
    const ctx = await this.loadEventForUser(eventId, userId);
    if (!ctx.isCreator && ctx.membership?.role !== 'Admin') {
      throw new AppError(
        'Only the event creator or a group admin can cancel this event',
        403,
      );
    }
    if (ctx.event.status === 'Cancelled') {
      throw new AppError('This event is already cancelled', 409);
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('events')
        .set({
          status: 'Cancelled',
          confirmed_start_time: null,
          confirmed_end_time: null,
          updated_at: new Date(),
        })
        .where('event_id', '=', eventId)
        .execute();

      await EventsService.notifyParticipants(
        trx,
        ctx.event,
        'event_status',
        `${ctx.event.name} was cancelled`,
        'This event will not happen.',
        '!',
        { excludeUserId: userId },
      );
    });

    return { id: eventId, status: 'Cancelled' as const };
  }

  private static async currentWindow(
    eventId: number,
    event: EventRecord,
    executor: Executor,
  ) {
    const blocks = await executor
      .selectFrom('open_time_blocks')
      .select(['user_id', 'date', 'start_time', 'end_time'])
      .where('event_id', '=', eventId)
      .execute();

    const declined = await executor
      .selectFrom('event_invites')
      .select('user_id')
      .where('event_id', '=', eventId)
      .where('response', '=', 'no')
      .execute();
    const declinedIds = new Set(declined.map((d) => d.user_id));

    const usable: AvailabilityBlock[] = blocks
      .filter((b) => !declinedIds.has(b.user_id))
      .map((b) => ({
        userId: b.user_id,
        date: toDateString(b.date),
        start: b.start_time,
        end: b.end_time,
      }));

    return findOverlapWindow(
      usable,
      event.min_attendees,
      event.min_duration_minutes,
    );
  }

  static async recomputeConfirmation(eventId: number, trx: Executor) {
    const event = await trx
      .selectFrom('events')
      .selectAll()
      .where('event_id', '=', eventId)
      .executeTakeFirst();
    if (!event || event.status === 'Cancelled') return;

    const window = await EventsService.currentWindow(eventId, event, trx);

    if (window && event.status !== 'Confirmed') {
      await trx
        .updateTable('events')
        .set({
          status: 'Confirmed',
          confirmed_start_time: window.start,
          confirmed_end_time: window.end,
          updated_at: new Date(),
        })
        .where('event_id', '=', eventId)
        .execute();

      const group = await trx
        .selectFrom('groups')
        .select('name')
        .where('group_id', '=', event.group_id)
        .executeTakeFirst();

      await EventsService.notifyParticipants(
        trx,
        event,
        'event_confirmed',
        `${event.name} is confirmed for ${formatWeekday(window.start)}`,
        `${group?.name ?? 'Group'}. Enough people overlap from ${formatClock(window.start)} to ${formatClock(window.end)}.`,
        '✓',
      );
    } else if (window && event.status === 'Confirmed') {
      await trx
        .updateTable('events')
        .set({
          confirmed_start_time: window.start,
          confirmed_end_time: window.end,
          updated_at: new Date(),
        })
        .where('event_id', '=', eventId)
        .execute();
    } else if (!window && event.status === 'Confirmed') {
      await trx
        .updateTable('events')
        .set({
          status: 'Waiting for people',
          confirmed_start_time: null,
          confirmed_end_time: null,
          updated_at: new Date(),
        })
        .where('event_id', '=', eventId)
        .execute();

      await EventsService.notifyParticipants(
        trx,
        event,
        'event_status',
        `${event.name} is no longer confirmed`,
        `Not enough people overlap for at least ${formatDuration(event.min_duration_minutes)} anymore.`,
        '!',
      );
    }
  }

  private static async notifyParticipants(
    trx: Executor,
    event: EventRecord,
    type: 'event_confirmed' | 'event_status',
    title: string,
    body: string,
    icon: string,
    options: { excludeUserId?: number } = {},
  ) {
    const invites = await trx
      .selectFrom('event_invites')
      .select(['user_id', 'response'])
      .where('event_id', '=', event.event_id)
      .execute();

    const recipients = new Set<number>([event.created_by]);
    for (const inv of invites) {
      if (inv.user_id !== null && inv.response !== 'no')
        recipients.add(inv.user_id);
    }
    if (options.excludeUserId !== undefined)
      recipients.delete(options.excludeUserId);

    for (const userId of recipients) {
      await notifyUser(trx, {
        userId,
        type,
        title,
        body,
        icon,
        actionLabel: 'View event',
        actionUrl: `/groups/${event.group_id}/events/${event.event_id}`,
        groupId: event.group_id,
        eventId: event.event_id,
      });
    }
  }
}
