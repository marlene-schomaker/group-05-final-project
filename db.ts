import { Generated, ColumnType } from 'kysely';

export interface UserTable {
  user_id: Generated<string>;
  name: string;
  email: string;
  password_hash: string;
}

export interface GroupTable {
  group_id: Generated<string>;
  name: string;
}

export interface OpenTimeBlockTable {
  block_id: Generated<string>;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
}

export interface GroupMemberTable {
  group_id: string;
  user_id: string;
}

export interface EventTypeTable {
  event_type_id: Generated<string>;
  group_id: string;
  name: string;
}

export interface EventTable {
  event_id: Generated<string>;
  group_id: string;
  event_type_id: string;
  status: 'proposed' | 'scheduled';
  start_datetime: ColumnType<Date | null, string | Date | null, string | Date | null>;
  end_datetime: ColumnType<Date | null, string | Date | null, string | Date | null>;
}

export interface EventInviteTable {
  event_id: string;
  user_id: string;
  response: 'pending' | 'yes' | 'no';
}

export interface Database {
  User: UserTable;
  Group: GroupTable;
  OpenTimeBlock: OpenTimeBlockTable;
  GroupMember: GroupMemberTable;
  EventType: EventTypeTable;
  Event: EventTable;
  EventInvite: EventInviteTable;
}