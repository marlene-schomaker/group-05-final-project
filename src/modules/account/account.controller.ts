import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { AccountService } from './account.service.js';

export class AccountController {
  static async getProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const profile = await AccountService.getProfile(req.user!.user_id);
      return res.status(200).json(profile);
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const updated = await AccountService.updateProfile(
        req.user!.user_id,
        req.body,
      );
      return res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async getPreferences(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const prefs = await AccountService.getPreferences(req.user!.user_id);
      return res.status(200).json(prefs);
    } catch (err) {
      next(err);
    }
  }

  static async updatePreferences(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const updated = await AccountService.updatePreferences(
        req.user!.user_id,
        req.body,
      );
      return res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
}
