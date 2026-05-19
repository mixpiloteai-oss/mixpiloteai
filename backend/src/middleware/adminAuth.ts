// ============================================================
// NEUROTEK AI — Admin Auth Middleware
// ============================================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const ADMIN_KEY = process.env.ADMIN_KEY ?? 'nt-admin-dev-2025';

// Explicit super_admin whitelist — emails granted full admin regardless of domain
const SUPER_ADMIN_EMAILS = new Set<string>([
  'tifenn.cruchon@gmail.com',
]);

export interface AdminRequest extends Request {
  adminId: string;
  adminEmail: string;
  adminRole: 'super_admin' | 'admin' | 'moderator';
}

/**
 * Reads the authenticated identity from the request.
 * Prefers x-admin-key, falls back to JWT sub.
 */
export function getAdminId(req: Request): string {
  const key = req.headers['x-admin-key'];
  if (typeof key === 'string' && key.length > 0) {
    return `admin-key:${key.slice(0, 8)}`;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, JWT_SECRET) as { id?: string; sub?: string };
      return payload.id ?? payload.sub ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }
  return 'unknown';
}

/**
 * Middleware: requires admin access.
 * - x-admin-key matching ADMIN_KEY → super_admin
 * - x-admin-role override (only when x-admin-key is valid)
 * - Bearer JWT with email ending @neurotek.ai → admin
 * - Otherwise 403
 */
export function requireAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): void {
  const adminKey = req.headers['x-admin-key'];

  // 1. Check x-admin-key header
  if (typeof adminKey === 'string' && adminKey.length > 0) {
    if (adminKey !== ADMIN_KEY) {
      res.status(403).json({ success: false, error: 'Invalid admin key' });
      return;
    }

    // Valid key → super_admin by default; allow override via x-admin-role header
    let role: AdminRequest['adminRole'] = 'super_admin';
    const roleOverride = req.headers['x-admin-role'];
    if (
      roleOverride === 'admin' ||
      roleOverride === 'moderator' ||
      roleOverride === 'super_admin'
    ) {
      role = roleOverride;
    }

    req.adminId = `admin-key:${adminKey.slice(0, 8)}`;
    req.adminEmail = 'system@neurotek.ai';
    req.adminRole = role;
    next();
    return;
  }

  // 2. Check Bearer JWT
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(403).json({ success: false, error: 'Admin access required' });
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

    const isNeurotek  = payload.email.endsWith('@neurotek.ai');
    const isSuperAdmin = SUPER_ADMIN_EMAILS.has(payload.email);

    if (!isNeurotek && !isSuperAdmin) {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    req.adminId = payload.id;
    req.adminEmail = payload.email;
    req.adminRole = isSuperAdmin ? 'super_admin' : 'admin';
    next();
  } catch {
    res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Middleware: requires super_admin role specifically.
 * Moderators and regular admins receive 403.
 */
export function requireSuperAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): void {
  requireAdmin(req, res, () => {
    if (req.adminRole !== 'super_admin') {
      res.status(403).json({ success: false, error: 'Super admin access required' });
      return;
    }
    next();
  });
}
