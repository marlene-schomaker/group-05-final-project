import type { Request, Response, NextFunction } from 'express';
import { db } from '../../db/database.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';

export class SupportController {
  static async contactSupport(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, subject, message } = req.body;
      const userId = (req as AuthenticatedRequest).user?.user_id || null;

      const ticket = await db
        .insertInto('support_tickets')
        .values({
          user_id: userId,
          email,
          subject,
          message,
          status: 'open',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return res.status(201).json({
        message: 'Support request received. We will get back to you by email.',
        ticketId: ticket.ticket_id,
      });
    } catch (err) {
      next(err);
    }
  }
}
