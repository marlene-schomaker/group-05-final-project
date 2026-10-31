import type { ColumnType, Generated } from 'kysely';

type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;

export interface Database {
  users: UsersTable;
  groups: GroupsTable;
  group_members: GroupMembersTable;
  open_time_blocks: OpenTimeBlocksTable;
  event_types: EventTypesTable;
  events: EventsTable;
  event_invites: EventInvitesTable;
}

export interface UsersTable {
  user_id: Generated<number>;
  name: string;
  email: string;
  password_hash: string;
}

export interface GroupsTable {
  group_id: Generated<number>;
  name: string;
}

export interface GroupMembersTable {
  group_id: number;
  user_id: number;
}

export interface OpenTimeBlocksTable {
  block_id: Generated<number>;
  user_id: number;
  date: ColumnType<Date, Date | string, Date | string>;
  start_time: string;
  end_time: string;
}

export interface EventTypesTable {
  event_type_id: Generated<number>;
  group_id: number;
  name: string;
}

export interface EventsTable {
  event_id: Generated<number>;
  group_id: number;
  event_type_id: number;
  status: Generated<'proposed' | 'scheduled'>;
  start_datetime: NullableTimestamp;
  end_datetime: NullableTimestamp;
}

export interface EventInvitesTable {
  event_id: number;
  user_id: number;
  response: Generated<'pending' | 'yes' | 'no'>;
}