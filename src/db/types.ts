import type { ColumnType, Generated } from 'kysely';

export type Timestamp = ColumnType<
  Date,
  Date | string | undefined,
  Date | string
>;
export type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;
export type DateString = ColumnType<string, string | undefined, string>;

export interface Database {
  users: UsersTable;
  refresh_tokens: RefreshTokensTable;
  user_notification_preferences: UserNotificationPreferencesTable;
  groups: GroupsTable;
  group_members: GroupMembersTable;
  events: EventsTable;
  event_invites: EventInvitesTable;
  open_time_blocks: OpenTimeBlocksTable;
  notifications: NotificationsTable;
  group_invites: GroupInvitesTable;
  email_outbox: EmailOutboxTable;
  support_tickets: SupportTicketsTable;
  weekly_availability: WeeklyAvailabilityTable;
}

export interface UsersTable {
  user_id: Generated<number>;
  name: string;
  email: string;
  password_hash: string;
  avatar_color: Generated<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RefreshTokensTable {
  token_id: Generated<number>;
  user_id: number;
  token_hash: string;
  expires_at: Timestamp;
  created_at: Timestamp;
}

export interface UserNotificationPreferencesTable {
  user_id: number;
  pref_invites: Generated<boolean>;
  pref_confirmed: Generated<boolean>;
  pref_email: Generated<boolean>;
  updated_at: Timestamp;
}

export interface GroupsTable {
  group_id: Generated<number>;
  name: string;
  description: string | null;
  color: Generated<string>;
  created_by: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface GroupMembersTable {
  group_id: number;
  user_id: number;
  role: Generated<'Admin' | 'Member'>;
  created_at: Timestamp;
}

export interface EventsTable {
  event_id: Generated<number>;
  group_id: number;
  created_by: number;
  name: string;
  min_duration_minutes: number;
  min_attendees: number;
  status: Generated<
    'Waiting for people' | 'Needs your reply' | 'Confirmed' | 'Cancelled'
  >;
  confirmed_start_time: NullableTimestamp;
  confirmed_end_time: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface EventInvitesTable {
  invite_id: Generated<number>;
  event_id: number;
  email: string;
  user_id: number | null;
  invited_by: number;
  response: Generated<'pending' | 'yes' | 'no'>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface OpenTimeBlocksTable {
  block_id: Generated<number>;
  user_id: number;
  event_id: number | null;
  date: ColumnType<string, string, string>;
  start_time: string;
  end_time: string;
  created_at: Timestamp;
}

export interface NotificationsTable {
  notification_id: Generated<number>;
  user_id: number;
  type:
    | 'event_invite'
    | 'event_confirmed'
    | 'event_status'
    | 'member_joined'
    | 'group_invite'
    | 'system';
  title: string;
  body: string;
  icon: Generated<string>;
  action_label: Generated<string | null>;
  action_url: string | null;
  is_read: Generated<boolean>;
  related_group_id: number | null;
  related_event_id: number | null;
  created_at: Timestamp;
}

export interface SupportTicketsTable {
  ticket_id: Generated<number>;
  user_id: number | null;
  email: string;
  subject: string;
  message: string;
  status: Generated<string>;
  created_at: Timestamp;
}

export interface GroupInvitesTable {
  invite_id: Generated<number>;
  group_id: number;
  email: string;
  user_id: number | null;
  invited_by: number;
  status: Generated<'pending' | 'accepted' | 'declined'>;
  created_at: Generated<Date>;
  updated_at: Timestamp;
}

export interface EmailOutboxTable {
  email_id: Generated<number>;
  to_email: string;
  subject: string;
  body: string;
  status: Generated<string>;
  created_at: Generated<Date>;
}

export interface WeeklyAvailabilityTable {
  slot_id: Generated<number>;
  user_id: number;
  day_of_week: number;
  start_hour: number;
}
