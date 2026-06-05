// ============================================================
// NEUROTEK AI — Auth Middleware
// ============================================================
// Validates Bearer JWT tokens with full claim checking and
// revocation support via the central tokenService.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/tokenService';

export interface AuthenticatedRequest extends Request {
  user?: {
    id:    string;
    email: string;
    name:  string;
    plan:  string;
    jti?:  string;
  };
}

// Hard-fail in production if JWT_SECRET is missing or still set to a dev value.
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.includes('dev-secret') || secret.includes('change-in-production')) {
    throw new Error('JWT_SECRET is missing or insecure in production');
  }
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }

  req.user = {
    id:    payload.id,
    email: payload.email,
    name:  payload.name,
    plan:  payload.plan,
    jti:   payload.jti,
  };
  next();
}

export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const payload = verifyAccessToken(token);
      if (payload) {
        req.user = {
          id:    payload.id,
          email: payload.email,
          name:  payload.name,
          plan:  payload.plan,
          jti:   payload.jti,
        };
      }
    }
  }
  next();
}
