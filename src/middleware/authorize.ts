import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { AppError } from './error-handler.js';
import { db } from '../db/database.js';
import { getNumericParam } from '../utils/params.js';

async function loadMembership(req: AuthenticatedRequest, paramName: string) {
  const userId = req.user?.user_id;
  if (!userId) throw new AppError('Unauthorized', 401);

  const groupId = getNumericParam(req.params[paramName]);
  if (Number.isNaN(groupId))
    throw new AppError('Invalid group id parameter', 400);

  const group = await db
    .selectFrom('groups')
    .select('group_id')
    .where('group_id', '=', groupId)
    .executeTakeFirst();
  if (!group) throw new AppError('Group not found', 404);

  return db
    .selectFrom('group_members')
    .select(['role'])
    .where('group_id', '=', groupId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
}

export function requireGroupMember(paramName = 'id') {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ) => {
    try {
      const membership = await loadMembership(req, paramName);
      if (!membership)
        throw new AppError('You are not a member of this group', 403);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireGroupAdmin(paramName = 'id') {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ) => {
    try {
      const membership = await loadMembership(req, paramName);
      if (!membership)
        throw new AppError('You are not a member of this group', 403);
      if (membership.role !== 'Admin')
        throw new AppError('Admin access required', 403);
      next();
    } catch (err) {
      next(err);
    }
  };
}
