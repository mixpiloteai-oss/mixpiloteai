// ============================================================
// NEUROTEK AI — Admin Auth Middleware (production-grade)
// ============================================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ── Secrets ───────────────────────────────────────────────────
// Hard-fail in production if these are missing or still set to dev defaults.
if (process.env.NODE_ENV === 'production') {
  const ajs = process.env.ADMIN_JWT_SECRET;
  if (!ajs || ajs.includes('admin-dev-secret') || ajs.includes('change-in-production')) {
    throw new Error('ADMIN_JWT_SECRET is missing or insecure in production');
  }
  const ak = process.env.ADMIN_KEY;
  if (!ak || ak.includes('nt-admin-dev-2025') || ak.includes('dev-')) {
    throw new Error('ADMIN_KEY is missing or insecure in production');
  }
}

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? 'admin-dev-secret-change-in-production';
const ADMIN_KEY = process.env.ADMIN_KEY ?? 'nt-admin-dev-2025';

// ── Super-admin whitelist ─────────────────────────────────────
export const SUPER_ADMIN_EMAILS = new Set<string>([
  'tifenn.cruchon@gmail.com',
]);

// ── Types ─────────────────────────────────────────────────────
export interface AdminRequest extends Request {
  adminId: string;
  adminEmail: string;
  adminRole: 'super_admin' | 'admin' | 'moderator';
}

export interface AdminJwtPayload {
  id: string;
  email: string;
  role: 'super_admin' | 'admin';
  iat?: number;
  exp?: number;
}

// ── In-memory refresh token store (fallback when no Supabase) ─
const inMemoryRefreshTokens = new Map<string, {
  adminId: string;
  adminEmail: string;
  role: 'super_admin' | 'admin';
  expiresAt: number;
  revoked: boolean;
}>();

// ── Brute-force tracker (by IP) ───────────────────────────────
interface AttemptEntry {
  count: number;
  firstAt: number;
  lockedUntil?: number;
}

const loginAttempts = new Map<string, AttemptEntry>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;   // 15 min
const LOCK_MS   = 30 * 60 * 1000;   // 30 min

// Clean stale entries every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    const expired = entry.lockedUntil
      ? now > entry.lockedUntil
      : now - entry.firstAt > WINDOW_MS;
    if (expired) loginAttempts.delete(ip);
  }
}, 10 * 60 * 1000);

export function isIPBlocked(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (entry.lockedUntil) {
    if (Date.now() < entry.lockedUntil) return true;
    loginAttempts.delete(ip);
  }
  return false;
}

export function recordLoginFailure(ip: string): { blocked: boolean; remainingAttempts: number } {
  const now = Date.now();
  let entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    entry = { count: 0, firstAt: now };
  }
  entry.count++;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCK_MS;
    loginAttempts.set(ip, entry);
    return { blocked: true, remainingAttempts: 0 };
  }
  loginAttempts.set(ip, entry);
  return { blocked: false, remainingAttempts: MAX_ATTEMPTS - entry.count };
}

export function recordLoginSuccess(ip: string): void {
  loginAttempts.delete(ip);
}

// ── Token helpers ─────────────────────────────────────────────
export function signAccessToken(payload: Omit<AdminJwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: '1h' });
}

export function signRefreshToken(payload: Omit<AdminJwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: '7d' });
}

export async function storeRefreshToken(
  token: string,
  adminId: string,
  adminEmail: string,
  role: 'super_admin' | 'admin',
  ip: string,
  userAgent: string
): Promise<void> {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

  if (isSupabaseConfigured) {
    await supabase!.from('admin_sessions').insert({
      id: uuidv4(),
      admin_id: adminId,
      admin_email: adminEmail,
      refresh_token: token,
      ip_address: ip,
      user_agent: userAgent,
      expires_at: new Date(expiresAt).toISOString(),
      revoked: false,
    });
    return;
  }
  inMemoryRefreshTokens.set(token, { adminId, adminEmail, role, expiresAt, revoked: false });
}

export async function validateRefreshToken(token: string): Promise<{
  adminId: string;
  adminEmail: string;
  role: 'super_admin' | 'admin';
} | null> {
  if (isSupabaseConfigured) {
    const { data } = await supabase!
      .from('admin_sessions')
      .select('admin_id, admin_email, revoked, expires_at')
      .eq('refresh_token', token)
      .maybeSingle();
    if (!data || data.revoked || new Date(data.expires_at as string) < new Date()) return null;
    const role = SUPER_ADMIN_EMAILS.has(data.admin_email as string) ? 'super_admin' : 'admin';
    return { adminId: data.admin_id as string, adminEmail: data.admin_email as string, role };
  }
  const entry = inMemoryRefreshTokens.get(token);
  if (!entry || entry.revoked || Date.now() > entry.expiresAt) return null;
  return { adminId: entry.adminId, adminEmail: entry.adminEmail, role: entry.role };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  if (isSupabaseConfigured) {
    await supabase!.from('admin_sessions').update({ revoked: true }).eq('refresh_token', token);
    return;
  }
  const entry = inMemoryRefreshTokens.get(token);
  if (entry) entry.revoked = true;
}

// ── Credential verification ───────────────────────────────────
export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<{ id: string; email: string; role: 'super_admin' | 'admin' } | null> {
  const isSuperAdmin = SUPER_ADMIN_EMAILS.has(email);

  // Try Supabase first
  if (isSupabaseConfigured) {
    const { data } = await supabase!
      .from('users')
      .select('id, email, password_hash, plan')
      .eq('email', email)
      .maybeSingle();
    if (data && data.password_hash) {
      const ok = await bcrypt.compare(password, data.password_hash as string);
      if (!ok) return null;
      return {
        id: data.id as string,
        email: data.email as string,
        role: isSuperAdmin ? 'super_admin' : 'admin',
      };
    }
  }

  // Env-var fallback
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
    return {
      id: 'env-admin',
      email,
      role: isSuperAdmin ? 'super_admin' : 'admin',
    };
  }

  return null;
}

// ── Middleware: requireAdmin ───────────────────────────────────
export function requireAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): void {
  const adminKey = req.headers['x-admin-key'];

  // 1. x-admin-key
  if (typeof adminKey === 'string' && adminKey.length > 0) {
    if (adminKey !== ADMIN_KEY) {
      res.status(403).json({ success: false, error: 'Invalid admin key' });
      return;
    }
    let role: AdminRequest['adminRole'] = 'super_admin';
    const roleOverride = req.headers['x-admin-role'];
    if (roleOverride === 'admin' || roleOverride === 'moderator' || roleOverride === 'super_admin') {
      role = roleOverride;
    }
    req.adminId    = `admin-key:${adminKey.slice(0, 8)}`;
    req.adminEmail = 'system@neurotek.ai';
    req.adminRole  = role;
    next();
    return;
  }

  // 2. Bearer JWT (Authorization header only — query param is excluded to prevent token leakage in logs)
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }

  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET) as AdminJwtPayload;

    // Accept admin-specific tokens (have role field)
    if (payload.role) {
      req.adminId    = payload.id;
      req.adminEmail = payload.email;
      req.adminRole  = payload.role;
      next();
      return;
    }

    // Fall back: regular user token — check email domain / whitelist
    const isNeurotek   = payload.email.endsWith('@neurotek.ai');
    const isSuperAdmin = SUPER_ADMIN_EMAILS.has(payload.email);
    if (!isNeurotek && !isSuperAdmin) {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }
    req.adminId    = payload.id;
    req.adminEmail = payload.email;
    req.adminRole  = isSuperAdmin ? 'super_admin' : 'admin';
    next();
  } catch {
    res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
}

// ── Middleware: requireSuperAdmin ─────────────────────────────
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

// ── Legacy helper (used in other routes) ─────────────────────
export function getAdminId(req: Request): string {
  const key = req.headers['x-admin-key'];
  if (typeof key === 'string' && key.length > 0) {
    return `admin-key:${key.slice(0, 8)}`;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, ADMIN_JWT_SECRET) as AdminJwtPayload;
      return payload.id ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }
  return 'unknown';
}
