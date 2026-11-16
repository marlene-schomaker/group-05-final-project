import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(
    message: string,
    statusCode = 400,
    details?: unknown,
    code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code ?? DEFAULT_CODES[statusCode] ?? 'ERROR';
    this.details = details;
  }
}

export function errorBody(code: string, message: string, details?: unknown) {
  return {
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
}

export function notFoundHandler(req: Request, res: Response) {
  res
    .status(404)
    .json(
      errorBody(
        'NOT_FOUND',
        `Route not found: ${req.method} ${req.originalUrl}`,
      ),
    );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(400).json(
      errorBody(
        'VALIDATION_ERROR',
        'Validation failed',
        err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      ),
    );
  }

  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json(errorBody(err.code, err.message, err.details));
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res
      .status(400)
      .json(errorBody('INVALID_JSON', 'Invalid JSON payload'));
  }

  console.error('Unhandled server error:', err);
  return res
    .status(500)
    .json(errorBody('INTERNAL_ERROR', 'Internal server error'));
}
