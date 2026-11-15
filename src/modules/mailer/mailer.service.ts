import type { Kysely } from 'kysely';
import type { Database } from '../../db/types.js';

export async function queueEmail(
  executor: Kysely<Database>,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  await executor
    .insertInto('email_outbox')
    .values({ to_email: to, subject, body })
    .execute();
}
