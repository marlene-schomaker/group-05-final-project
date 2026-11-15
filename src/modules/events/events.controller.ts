import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { EventsService } from './events.service.js';
import { getNumericParam } from '../../utils/params.js';

export class EventsController {
  static async listByGroup(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const groupId = getNumericParam(req.params.groupId);
      const events = await EventsService.listGroupEvents(
        groupId,
        req.user!.user_id,
      );
      return res.status(200).json(events);
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
      const groupId = getNumericParam(req.params.groupId);
      const event = await EventsService.createEvent(
        groupId,
        req.user!.user_id,
        req.body,
      );
      return res.status(201).json(event);
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
      const eventId = getNumericParam(req.params.id);
      const event = await EventsService.getEventById(
        eventId,
        req.user!.user_id,
      );
      return res.status(200).json(event);
    } catch (err) {
      next(err);
    }
  }

  static async respond(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const eventId = getNumericParam(req.params.id);
      const result = await EventsService.respondToInvite(
        eventId,
        req.user!.user_id,
        req.body.response,
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async submitAvailability(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const eventId = getNumericParam(req.params.id);
      const result = await EventsService.submitAvailability(
        eventId,
        req.user!.user_id,
        req.body.slots,
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getAvailability(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const eventId = getNumericParam(req.params.id);
      const result = await EventsService.getAvailability(
        eventId,
        req.user!.user_id,
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async cancel(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const eventId = getNumericParam(req.params.id);
      const result = await EventsService.cancelEvent(
        eventId,
        req.user!.user_id,
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
