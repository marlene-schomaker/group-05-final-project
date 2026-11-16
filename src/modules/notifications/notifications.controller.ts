import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { NotificationsService } from './notifications.service.js';
import { getNumericParam } from '../../utils/params.js';

export class NotificationsController {
  static async list(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const filter = req.query.filter as
        'all' | 'invites' | 'updates' | undefined;
      const result = await NotificationsService.listUserNotifications(
        req.user!.user_id,
        filter,
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getUnreadCount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await NotificationsService.getUnreadCount(
        req.user!.user_id,
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async markRead(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const notifId = getNumericParam(req.params.id);
      const result = await NotificationsService.markAsRead(
        notifId,
        req.user!.user_id,
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async markAllRead(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await NotificationsService.markAllAsRead(
        req.user!.user_id,
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
