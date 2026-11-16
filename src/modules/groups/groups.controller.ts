import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { GroupsService } from './groups.service.js';
import { getNumericParam } from '../../utils/params.js';

export class GroupsController {
  static async list(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const groups = await GroupsService.listUserGroups(req.user!.user_id);
      return res.status(200).json(groups);
    } catch (err) {
      next(err);
    }
  }

  static async create(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const group = await GroupsService.createGroup(
        req.user!.user_id,
        req.body,
      );
      return res.status(201).json(group);
    } catch (err) {
      next(err);
    }
  }

  static async getById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const groupId = getNumericParam(req.params.id);
      const group = await GroupsService.getGroupDetails(
        groupId,
        req.user!.user_id,
      );
      return res.status(200).json(group);
    } catch (err) {
      next(err);
    }
  }

  static async update(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const groupId = getNumericParam(req.params.id);
      const updated = await GroupsService.updateGroup(groupId, req.body);
      return res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async inviteMembers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const groupId = getNumericParam(req.params.id);
      const result = await GroupsService.inviteMembers(
        groupId,
        req.user!.user_id,
        req.body.emails,
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async delete(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const groupId = getNumericParam(req.params.id);
      const result = await GroupsService.deleteGroup(groupId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async removeMember(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await GroupsService.removeMember(
        getNumericParam(req.params.id),
        req.user!.user_id,
        getNumericParam(req.params.userId),
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateMemberRole(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await GroupsService.updateMemberRole(
        getNumericParam(req.params.id),
        getNumericParam(req.params.userId),
        req.body.role,
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
