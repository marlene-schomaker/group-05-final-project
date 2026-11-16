import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import {
  authenticate,
  type AuthenticatedRequest,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { GroupsService } from '../groups/groups.service.js';
import { groupInviteParamSchema } from '../groups/groups.validation.js';
import { getNumericParam } from '../../utils/params.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res
        .status(200)
        .json(await GroupsService.listPendingInvites(req.user!.user_id));
    } catch (err) {
      next(err);
    }
  },
);

for (const [action, decision] of [
  ['accept', 'accepted'],
  ['decline', 'declined'],
] as const) {
  router.post(
    `/:id/${action}`,
    validate(groupInviteParamSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await GroupsService.respondToGroupInvite(
          getNumericParam(req.params.id),
          req.user!.user_id,
          decision,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );
}

export default router;
