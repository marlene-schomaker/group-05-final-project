import crypto from 'crypto';
import { db } from '../../db/database.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';
import { AppError } from '../../middleware/error-handler.js';
import { claimPendingInvites } from '../invites/invites.service.js';

export class AuthService {
  static async register(data: {
    name?: string;
    email: string;
    password: string;
    avatarColor?: string;
  }) {
    const emailLower = data.email.toLowerCase().trim();

    const existingUser = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', emailLower)
      .executeTakeFirst();

    if (existingUser) {
      throw new AppError('Email already in use', 409);
    }

    const passwordHash = await hashPassword(data.password);

    const result = await db.transaction().execute(async (trx) => {
      const newUser = await trx
        .insertInto('users')
        .values({
          name: data.name?.trim() || emailLower.split('@')[0],
          email: emailLower,
          password_hash: passwordHash,
          avatar_color: data.avatarColor || 'blue',
        })
        .returning(['user_id', 'name', 'email', 'avatar_color', 'created_at'])
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('user_notification_preferences')
        .values({
          user_id: newUser.user_id,
          pref_invites: true,
          pref_confirmed: true,
          pref_email: false,
        })
        .execute();

      await claimPendingInvites(trx, newUser);

      return newUser;
    });

    const tokenPayload = { user_id: result.user_id, email: result.email };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db
      .insertInto('refresh_tokens')
      .values({
        user_id: result.user_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .execute();

    return {
      user: {
        id: result.user_id,
        name: result.name,
        email: result.email,
        avatarColor: result.avatar_color,
        created_at: result.created_at,
      },
      token: accessToken,
      accessToken,
      refreshToken,
    };
  }

  static async login(data: { email: string; password: string }) {
    const emailLower = data.email.toLowerCase().trim();

    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', emailLower)
      .executeTakeFirst();

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const passwordMatch = await comparePassword(
      data.password,
      user.password_hash,
    );
    if (!passwordMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    await claimPendingInvites(db, user);

    const tokenPayload = { user_id: user.user_id, email: user.email };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db
      .insertInto('refresh_tokens')
      .values({
        user_id: user.user_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .execute();

    return {
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        avatarColor: user.avatar_color,
      },
      token: accessToken,
      accessToken,
      refreshToken,
    };
  }

  static async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const stored = await db
      .selectFrom('refresh_tokens')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .where('expires_at', '>', new Date())
      .executeTakeFirst();

    if (!stored) {
      throw new AppError('Refresh token revoked or expired', 401);
    }

    await db
      .deleteFrom('refresh_tokens')
      .where('token_id', '=', stored.token_id)
      .execute();

    const tokenPayload = { user_id: payload.user_id, email: payload.email };
    const newAccessToken = signAccessToken(tokenPayload);
    const newRefreshToken = signRefreshToken(tokenPayload);

    const newHash = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db
      .insertInto('refresh_tokens')
      .values({
        user_id: payload.user_id,
        token_hash: newHash,
        expires_at: expiresAt,
      })
      .execute();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');
      await db
        .deleteFrom('refresh_tokens')
        .where('token_hash', '=', tokenHash)
        .execute();
    }
    return { message: 'Logged out successfully' };
  }
}
