import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = (parsed as any).body ?? req.body;
      req.query = (parsed as any).query ?? req.query;
      req.params = (parsed as any).params ?? req.params;
      next();
    } catch (error) {
      next(error);
    }
  };
}
