import type { Kysely } from 'kysely';
import type { Database } from '../../db/types.js';
import { notifyUser } from '../notifications/notifications.dispatch.js';
import { formatDuration } from '../../utils/format.js';

export async function claimPendingInvites(
  trx: Kysely<Database>,
  user: { user_id: number; email: string },
): Promise<void> {
  const email = user.email.toLowerCase();

  const eventInvites = await trx
    .selectFrom('event_invites')
    .innerJoin('events', 'events.event_id', 'event_invites.event_id')
    .innerJoin('groups', 'groups.group_id', 'events.group_id')
    .innerJoin(
      'users as inviter',
      'inviter.user_id',
      'event_invites.invited_by',
    )
    .select([
      'event_invites.invite_id',
      'event_invites.event_id',
      'events.group_id',
      'events.name as event_name',
      'events.min_duration_minutes',
      'events.min_attendees',
      'events.status',
      'groups.name as group_name',
      'inviter.name as inviter_name',
    ])
    .where('event_invites.email', '=', email)
    .where('event_invites.user_id', 'is', null)
    .execute();

  for (const inv of eventInvites) {
    await trx
      .updateTable('event_invites')
      .set({ user_id: user.user_id, updated_at: new Date() })
      .where('invite_id', '=', inv.invite_id)
      .execute();

    if (inv.status === 'Cancelled') continue;

    await notifyUser(trx, {
      userId: user.user_id,
      type: 'event_invite',
      title: `${inv.inviter_name} invited you to ${inv.event_name}`,
      body: `${inv.group_name}. Needs ${inv.min_attendees} people free for at least ${formatDuration(inv.min_duration_minutes)}. Pick the times you can make.`,
      icon: '@',
      actionLabel: 'Pick your times',
      actionUrl: `/groups/${inv.group_id}/events/${inv.event_id}`,
      groupId: inv.group_id,
      eventId: inv.event_id,
    });
  }

  const groupInvites = await trx
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
    ])
    .where('group_invites.email', '=', email)
    .where('group_invites.user_id', 'is', null)
    .where('group_invites.status', '=', 'pending')
    .execute();

  for (const inv of groupInvites) {
    await trx
      .updateTable('group_invites')
      .set({ user_id: user.user_id, updated_at: new Date() })
      .where('invite_id', '=', inv.invite_id)
      .execute();

    await notifyUser(trx, {
      userId: user.user_id,
      type: 'group_invite',
      title: `${inv.inviter_name} invited you to join ${inv.group_name}`,
      body: `Accept to become a member of ${inv.group_name}.`,
      icon: '@',
      actionLabel: 'View invite',
      actionUrl: `/group-invites/${inv.invite_id}`,
      groupId: inv.group_id,
    });
  }
}
