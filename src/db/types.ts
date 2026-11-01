import { Generated, ColumnType } from 'kysely';

export interface Database {
  users: UserTable;
  groups: GroupTable;
  group_members: GroupMemberTable;
  saved_schedules: SavedScheduleTable;
  events: EventTable;
  time_blocks: TimeBlockTable;
}

export interface UserTable {
  id: Generated<number>;
  email: string;
  password_hash: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface GroupTable {
  id: Generated<number>;
  name: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface GroupMemberTable {
  group_id: number;
  user_id: number;
}

export interface SavedScheduleTable {
  id: Generated<number>;
  user_id: number;
  name: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface EventTable {
  id: Generated<number>;
  group_id: number;
  organizer_id: number;
  title: string;
  duration_minutes: number;
  min_attendees: number;
  status: Generated<'proposed' | 'scheduled'>;
  scheduled_start: Date | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface TimeBlockTable {
  id: Generated<number>;
  user_id: number;
  saved_schedule_id: number | null;
  event_id: number | null;
  start_at: Date;
  end_at: Date;
}
