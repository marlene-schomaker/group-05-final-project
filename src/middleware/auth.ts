import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type TokenPayload } from '../utils/jwt.js';
import { AppError } from './error-handler.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

export function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  const token = readBearer(req);
  if (!token) {
    return next(new AppError('Missing or invalid Authorization header', 401));
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

export function optionalAuthenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  const token = readBearer(req);
  if (token) {
    try {
      req.user = verifyAccessToken(token);
    } catch {
      // invalid token on an optional route is treated as anonymous
    }
  }
  next();
}

export const verifyJWT = authenticate;
