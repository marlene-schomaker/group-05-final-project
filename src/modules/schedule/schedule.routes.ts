import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ScheduleService } from './schedule.service.js';
import { saveScheduleSchema } from './schedule.validation.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await ScheduleService.get(req.user!.user_id));
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/',
  validate(saveScheduleSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(
        await ScheduleService.replace(req.user!.user_id, req.body.availability),
      );
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await ScheduleService.clear(req.user!.user_id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
