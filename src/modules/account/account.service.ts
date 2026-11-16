import { db } from '../../db/database.js';
import { AppError } from '../../middleware/error-handler.js';

export class AccountService {
  static async getProfile(userId: number) {
    const user = await db
      .selectFrom('users')
      .select(['user_id', 'name', 'email', 'avatar_color', 'created_at'])
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  static async updateProfile(
    userId: number,
    data: { name?: string; email?: string; avatarColor?: string },
  ) {
    if (data.email) {
      const emailLower = data.email.toLowerCase().trim();
      const existing = await db
        .selectFrom('users')
        .select(['user_id'])
        .where('email', '=', emailLower)
        .where('user_id', '!=', userId)
        .executeTakeFirst();
      if (existing) {
        throw new AppError('Email already in use', 409);
      }
      data.email = emailLower;
    }

    const updated = await db
      .updateTable('users')
      .set({
        ...(data.name ? { name: data.name } : {}),
        ...(data.email ? { email: data.email } : {}),
        ...(data.avatarColor ? { avatar_color: data.avatarColor } : {}),
        updated_at: new Date(),
      })
      .where('user_id', '=', userId)
      .returning(['user_id', 'name', 'email', 'avatar_color', 'updated_at'])
      .executeTakeFirstOrThrow();

    return updated;
  }

  static async getPreferences(userId: number) {
    let prefs = await db
      .selectFrom('user_notification_preferences')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!prefs) {
      prefs = await db
        .insertInto('user_notification_preferences')
        .values({
          user_id: userId,
          pref_invites: true,
          pref_confirmed: true,
          pref_email: false,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    return {
      prefInvites: prefs.pref_invites,
      prefConfirmed: prefs.pref_confirmed,
      prefEmail: prefs.pref_email,
    };
  }

  static async updatePreferences(
    userId: number,
    data: {
      prefInvites?: boolean;
      prefConfirmed?: boolean;
      prefEmail?: boolean;
    },
  ) {
    const existing = await db
      .selectFrom('user_notification_preferences')
      .select(['user_id'])
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!existing) {
      await db
        .insertInto('user_notification_preferences')
        .values({
          user_id: userId,
          pref_invites: data.prefInvites ?? true,
          pref_confirmed: data.prefConfirmed ?? true,
          pref_email: data.prefEmail ?? false,
        })
        .execute();
    } else {
      await db
        .updateTable('user_notification_preferences')
        .set({
          ...(data.prefInvites !== undefined
            ? { pref_invites: data.prefInvites }
            : {}),
          ...(data.prefConfirmed !== undefined
            ? { pref_confirmed: data.prefConfirmed }
            : {}),
          ...(data.prefEmail !== undefined
            ? { pref_email: data.prefEmail }
            : {}),
          updated_at: new Date(),
        })
        .where('user_id', '=', userId)
        .execute();
    }

    return this.getPreferences(userId);
  }
}
