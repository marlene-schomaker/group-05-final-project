import { Router } from 'express';
import { GroupsController } from './groups.controller.js';
import { authenticate } from '../../middleware/auth.js';
import {
  requireGroupMember,
  requireGroupAdmin,
} from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  createGroupSchema,
  updateGroupSchema,
  inviteMembersSchema,
  groupIdParamSchema,
  memberParamSchema,
  updateMemberRoleSchema,
} from './groups.validation.js';

const router = Router();

router.use(authenticate);

router.get('/', GroupsController.list);
router.post('/', validate(createGroupSchema), GroupsController.create);

router.get(
  '/:id',
  validate(groupIdParamSchema),
  requireGroupMember('id'),
  GroupsController.getById,
);
router.put(
  '/:id',
  validate(updateGroupSchema),
  requireGroupAdmin('id'),
  GroupsController.update,
);
router.delete(
  '/:id',
  validate(groupIdParamSchema),
  requireGroupAdmin('id'),
  GroupsController.delete,
);

router.post(
  '/:id/invites',
  validate(inviteMembersSchema),
  requireGroupMember('id'),
  GroupsController.inviteMembers,
);
router.post(
  '/:id/members',
  validate(inviteMembersSchema),
  requireGroupMember('id'),
  GroupsController.inviteMembers,
);

router.delete(
  '/:id/members/:userId',
  validate(memberParamSchema),
  requireGroupMember('id'),
  GroupsController.removeMember,
);
router.patch(
  '/:id/members/:userId',
  validate(updateMemberRoleSchema),
  requireGroupAdmin('id'),
  GroupsController.updateMemberRole,
);

export default router;
