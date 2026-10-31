import { Generated, ColumnType } from 'kysely'

export interface Database {
    users: UserTable;
}

export interface UserTable {
    id: Generated<number>;
    email: string;
    password_hash: string;
    created_at: ColumnType<Date, string | undefined, never>;
}