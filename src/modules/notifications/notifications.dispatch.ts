import type { Kysely } from 'kysely';
import type { Database } from '../../db/types.js';
import { queueEmail } from '../mailer/mailer.service.js';

type NotificationType = Database['notifications']['type'];

export interface NotificationInput {
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  icon: string;
  actionLabel: string;
  actionUrl: string;
  groupId?: number | null;
  eventId?: number | null;
}

const PREF_FOR_TYPE: Partial<
  Record<NotificationType, 'pref_invites' | 'pref_confirmed'>
> = {
  event_invite: 'pref_invites',
  group_invite: 'pref_invites',
  event_confirmed: 'pref_confirmed',
};

export async function notifyUser(
  executor: Kysely<Database>,
  input: NotificationInput,
): Promise<boolean> {
  const prefs = await executor
    .selectFrom('user_notification_preferences')
    .selectAll()
    .where('user_id', '=', input.userId)
    .executeTakeFirst();

  const prefKey = PREF_FOR_TYPE[input.type];
  if (prefs && prefKey && !prefs[prefKey]) return false;

  await executor
    .insertInto('notifications')
    .values({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      icon: input.icon,
      action_label: input.actionLabel,
      action_url: input.actionUrl,
      related_group_id: input.groupId ?? null,
      related_event_id: input.eventId ?? null,
    })
    .execute();

  if (prefs?.pref_email) {
    const user = await executor
      .selectFrom('users')
      .select('email')
      .where('user_id', '=', input.userId)
      .executeTakeFirst();
    if (user) await queueEmail(executor, user.email, input.title, input.body);
  }

  return true;
}
