import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export interface AuthenticatedRequest extends Request {
    user?: {user_id: number; email: string};
}

export function verifyJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if(!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({error: "Unauthorized: MIssing or invalid token header"});
    }
    const token = authHeader.split(' ')[1];

    try {
        const payload  = jwt.verify(token, JWT_SECRET) as {user_id: number, email: string};
        req.user = payload;
        next();
    } catch(err) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token"})
    }
}