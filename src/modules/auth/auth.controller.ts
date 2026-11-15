import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.register(req.body);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.login(req.body);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.refresh(req.body.refreshToken);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.logout(req.body?.refreshToken);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response) {
    return res.status(200).json({ user: req.user });
  }
}
