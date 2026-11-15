import { z } from 'zod';
import { GROUP_COLORS } from '../../utils/format.js';

const idParam = z.coerce.number().int().positive();
const email = z.string().trim().email('Invalid email').max(255);

export const createGroupSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Group name is required').max(150),
    description: z.string().trim().max(500).optional(),
    color: z.enum(GROUP_COLORS).default('blue'),
    inviteEmails: z.array(email).max(100).optional().default([]),
  }),
});

export const updateGroupSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Group name is required')
      .max(150)
      .optional(),
    description: z.string().trim().max(500).optional(),
    color: z.enum(GROUP_COLORS).optional(),
  }),
  params: z.object({ id: idParam }),
});

export const inviteMembersSchema = z.object({
  body: z.object({
    emails: z.array(email).min(1, 'At least one email is required').max(100),
  }),
  params: z.object({ id: idParam }),
});

export const groupIdParamSchema = z.object({
  params: z.object({ id: idParam }),
});

export const memberParamSchema = z.object({
  params: z.object({ id: idParam, userId: idParam }),
});

export const updateMemberRoleSchema = z.object({
  body: z.object({ role: z.enum(['Admin', 'Member']) }),
  params: z.object({ id: idParam, userId: idParam }),
});

export const groupInviteParamSchema = z.object({
  params: z.object({ id: idParam }),
});
