import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { HomeService } from './home.service.js';

export class HomeController {
  static async getDashboard(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const dashboard = await HomeService.getDashboard(req.user!.user_id);
      return res.status(200).json(dashboard);
    } catch (err) {
      next(err);
    }
  }
}
