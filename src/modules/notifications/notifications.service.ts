import { sql } from 'kysely';
import { db } from '../../db/database.js';
import { AppError } from '../../middleware/error-handler.js';
import { relativeTime } from '../../utils/format.js';

const INVITE_TYPES = ['event_invite', 'group_invite'] as const;
const UPDATE_TYPES = [
  'event_confirmed',
  'event_status',
  'member_joined',
  'system',
] as const;

const STYLE_BY_TYPE: Record<string, { bg: string; fg: string; icon?: string }> =
  {
    event_invite: { bg: '#E7ECFF', fg: '#2F44B8' },
    group_invite: { bg: '#E7ECFF', fg: '#2F44B8' },
    event_confirmed: { bg: '#DFF5EA', fg: '#1B6B45', icon: '✓' },
    event_status: { bg: '#FDEBD3', fg: '#8A4B08', icon: '!' },
    member_joined: { bg: '#EAECF0', fg: '#344054', icon: '+' },
    system: { bg: '#EAECF0', fg: '#344054' },
  };

export class NotificationsService {
  static async listUserNotifications(
    userId: number,
    filter: 'all' | 'invites' | 'updates' = 'all',
  ) {
    let query = db
      .selectFrom('notifications')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .orderBy('notification_id', 'desc');

    if (filter === 'invites') {
      query = query.where('type', 'in', [...INVITE_TYPES]);
    } else if (filter === 'updates') {
      query = query.where('type', 'in', [...UPDATE_TYPES]);
    }

    const items = await query.execute();
    const { unreadCount } = await NotificationsService.getUnreadCount(userId);

    const formatted = items.map((n) => {
      const style = STYLE_BY_TYPE[n.type] ?? STYLE_BY_TYPE.system;
      const unread = !n.is_read;

      return {
        id: n.notification_id,
        type: n.type,
        icon: style.icon ?? n.icon,
        title: n.title,
        body: n.body,
        when: relativeTime(new Date(n.created_at)),
        createdAt: n.created_at,
        action: n.action_label || 'View event',
        actionUrl: n.action_url,
        groupId: n.related_group_id,
        eventId: n.related_event_id,
        isRead: n.is_read,
        bg: style.bg,
        fg: style.fg,
        border: unread ? '#C7D2FE' : '#E4E7EC',
        dot: unread ? '#3B5BDB' : 'transparent',
        btnBg: unread ? '#3B5BDB' : '#EAECF0',
        btnFg: unread ? '#FFFFFF' : '#344054',
      };
    });

    return { items: formatted, unreadCount };
  }

  static async getUnreadCount(userId: number) {
    const res = await db
      .selectFrom('notifications')
      .select(sql<number>`count(*)`.as('count'))
      .where('user_id', '=', userId)
      .where('is_read', '=', false)
      .executeTakeFirst();

    return { unreadCount: Number(res?.count ?? 0) };
  }

  static async markAsRead(notificationId: number, userId: number) {
    const found = await db
      .selectFrom('notifications')
      .select('notification_id')
      .where('notification_id', '=', notificationId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!found) throw new AppError('Notification not found', 404);

    await db
      .updateTable('notifications')
      .set({ is_read: true })
      .where('notification_id', '=', notificationId)
      .where('user_id', '=', userId)
      .execute();

    return { id: notificationId, isRead: true };
  }

  static async markAllAsRead(userId: number) {
    const res = await db
      .updateTable('notifications')
      .set({ is_read: true })
      .where('user_id', '=', userId)
      .where('is_read', '=', false)
      .execute();

    return { markedReadCount: Number(res[0]?.numUpdatedRows ?? 0) };
  }
}
