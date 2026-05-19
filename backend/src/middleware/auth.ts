// ============================================================
// NEUROTEK AI — Auth Middleware
// ============================================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    plan: string;
  };
}

// Hard-fail in production if JWT_SECRET is missing or still set to a dev value.
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.includes('dev-secret') || secret.includes('change-in-production')) {
    throw new Error('JWT_SECRET is missing or insecure in production');
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      name: string;
      plan: string;
    };
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, JWT_SECRET) as {
        id: string;
        email: string;
        name: string;
        plan: string;
      };
      req.user = payload;
    } catch {
      // ignore invalid tokens for optional auth
    }
  }
  next();
}
