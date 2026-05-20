import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authRateLimiter } from '../middleware/rateLimiter';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../utils/validate';
import { logSecurityEvent } from '../utils/securityLog';
import {
  findUserByEmail,
  findUserById,
  createUser,
  setRefreshToken,
  getTodayUsage,
  getDailyLimit,
  type Plan,
} from '../services/userService';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  verifyRefreshTokenHash,
  revokeJti,
} from '../lib/tokenService';
import {
  checkAccountLock,
  recordFailure,
  recordSuccess,
} from '../lib/authThrottle';

const router = Router();

// ── Token signing helper ─────────────────────────────────────────────────────

function signTokenPair(
  userId: string,
  email: string,
  name: string,
  plan: string,
  family?: string,
): { accessToken: string; refreshToken: string; refreshTokenHash: string; family: string } {
  const accessToken = signAccessToken({ id: userId, email, name, plan });
  const { token: refreshToken, family: fam } = signRefreshToken(userId, family);
  return {
    accessToken,
    refreshToken,
    refreshTokenHash: hashRefreshToken(refreshToken),
    family: fam,
  };
}

// ── POST /api/auth/register ─────────────────────────────────────────────────

router.post('/register', authRateLimiter, async (req: Request, res: Response) => {
  if (!validate(req, res, {
    email:    { required: true, type: 'email' },
    password: { required: true, type: 'string', min: 8, max: 200 },
    name:     { required: true, type: 'string', min: 1, max: 120 },
  })) return;

  const { email, password, name } = req.body as { email: string; password: string; name: string };
  try {
    const user = await createUser({ email, password, name });
    const tokens = signTokenPair(user.id, user.email, user.name, user.plan);
    // Store hashed refresh token (not plaintext)
    await setRefreshToken(user.id, tokens.refreshTokenHash);

    logSecurityEvent({
      type: 'auth_success',
      severity: 'info',
      ip: req.ip,
      userId: user.id,
      email: user.email,
      route: '/api/auth/register',
    });

    res.status(201).json({
      success: true,
      data: {
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
      },
    });
  } catch (err) {
    const e = err as Error;
    const status = e.message === 'Email already in use' ? 409 : 500;
    logSecurityEvent({
      type: 'auth_failure',
      severity: 'warn',
      ip: req.ip,
      email,
      route: '/api/auth/register',
      reason: e.message,
    });
    res.status(status).json({ success: false, error: e.message });
  }
});

// ── POST /api/auth/login ────────────────────────────────────────────────────

router.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  if (!validate(req, res, {
    email:    { required: true, type: 'email' },
    password: { required: true, type: 'string', min: 1, max: 200 },
  })) return;

  const { email, password } = req.body as { email: string; password: string };

  // Per-account throttling (complements IP-based authRateLimiter)
  const lock = checkAccountLock(email);
  if (lock.locked) {
    logSecurityEvent({
      type: 'account_locked',
      severity: 'warn',
      ip: req.ip,
      email,
      route: '/api/auth/login',
      reason: `locked until ${new Date(lock.lockedUntilMs).toISOString()}`,
    });
    res.status(429).json({
      success: false,
      error: 'Account temporarily locked due to too many failed attempts',
      code:  'ACCOUNT_LOCKED',
      retryAfter: Math.ceil((lock.lockedUntilMs - Date.now()) / 1000),
    });
    return;
  }

  try {
    const user = await findUserByEmail(email);

    // Use async bcrypt.compare (does NOT block event loop)
    // Always compare against something to mitigate timing attacks
    const hashToCheck = user?.passwordHash ?? '$2a$10$DUMMYHASHFORTIMINGRESISTANCEXXXXXXXXXXXXXXXXXXX.';
    const valid = user ? await bcrypt.compare(password, hashToCheck) : false;
    // Burn a comparison even on miss to keep timing constant
    if (!user) await bcrypt.compare(password, hashToCheck).catch(() => false);

    if (!user || !valid) {
      const status = recordFailure(email);
      logSecurityEvent({
        type: 'auth_failure',
        severity: 'warn',
        ip: req.ip,
        email,
        route: '/api/auth/login',
        reason: 'invalid credentials',
      });
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        ...(status.remainingAttempts < 3 ? { remainingAttempts: status.remainingAttempts } : {}),
      });
      return;
    }

    recordSuccess(email);

    const tokens = signTokenPair(user.id, user.email, user.name, user.plan);
    await setRefreshToken(user.id, tokens.refreshTokenHash);

    const used  = await getTodayUsage(user.id);
    const limit = getDailyLimit(user.plan as Plan);

    logSecurityEvent({
      type: 'auth_success',
      severity: 'info',
      ip: req.ip,
      userId: user.id,
      email: user.email,
      route: '/api/auth/login',
    });

    res.json({
      success: true,
      data: {
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user:  { id: user.id, email: user.email, name: user.name, plan: user.plan },
        quota: { used, limit, remaining: Math.max(0, limit - used) },
      },
    });
  } catch (err) {
    const e = err as Error;
    logSecurityEvent({
      type: 'auth_failure',
      severity: 'critical',
      ip: req.ip,
      email,
      route: '/api/auth/login',
      reason: e.message,
    });
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
});

// ── POST /api/auth/refresh ──────────────────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken || typeof refreshToken !== 'string') {
    res.status(400).json({ success: false, error: 'refreshToken is required' });
    return;
  }

  // 1. Verify signature/expiry
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    logSecurityEvent({
      type: 'invalid_token',
      severity: 'warn',
      ip: req.ip,
      route: '/api/auth/refresh',
      reason: 'verify failed',
    });
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    return;
  }

  // 2. Load user
  let user;
  try {
    user = await findUserById(payload.id);
  } catch (err) {
    logSecurityEvent({
      type: 'invalid_token',
      severity: 'critical',
      ip: req.ip,
      route: '/api/auth/refresh',
      reason: `DB error: ${(err as Error).message}`,
    });
    res.status(500).json({ success: false, error: 'Token refresh failed' });
    return;
  }

  if (!user || !user.refreshToken) {
    logSecurityEvent({
      type: 'invalid_token',
      severity: 'warn',
      ip: req.ip,
      route: '/api/auth/refresh',
      reason: 'no stored refresh token',
    });
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
    return;
  }

  // 3. Constant-time hash compare
  if (!verifyRefreshTokenHash(refreshToken, user.refreshToken)) {
    // Token reuse / theft suspected — revoke entire family
    revokeJti(payload.jti);
    await setRefreshToken(user.id, null).catch(() => { /* ignore */ });
    logSecurityEvent({
      type: 'invalid_token',
      severity: 'critical',
      ip: req.ip,
      userId: user.id,
      route: '/api/auth/refresh',
      reason: 'refresh token mismatch — possible theft, all sessions revoked',
    });
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
    return;
  }

  // 4. Issue new pair (rotation) — invalidate old token
  revokeJti(payload.jti);
  const tokens = signTokenPair(user.id, user.email, user.name, user.plan, payload.family);
  await setRefreshToken(user.id, tokens.refreshTokenHash);

  logSecurityEvent({
    type: 'auth_success',
    severity: 'info',
    ip: req.ip,
    userId: user.id,
    route: '/api/auth/refresh',
  });

  res.json({
    success: true,
    data: {
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
  });
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────

router.get('/me', requireAuth as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await findUserById(req.user!.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }
      const used = await getTodayUsage(user.id);
      const limit = getDailyLimit(user.plan as Plan);
      res.json({
        success: true,
        data: {
          id: user.id, email: user.email, name: user.name, plan: user.plan,
          quota: { used, limit, remaining: Math.max(0, limit - used) },
        },
      });
    } catch (err) {
      const e = err as Error;
      logSecurityEvent({
        type: 'auth_failure',
        severity: 'warn',
        ip: req.ip,
        userId: req.user?.id,
        route: '/api/auth/me',
        reason: e.message,
      });
      res.status(500).json({ success: false, error: 'Failed to load user' });
    }
  });

// ── POST /api/auth/logout ───────────────────────────────────────────────────

router.post('/logout', requireAuth as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Revoke current access token if it has a jti
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        const token = auth.slice(7);
        // Decode without verify to get jti (already verified by requireAuth)
        try {
          const segments = token.split('.');
          if (segments.length === 3) {
            const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString());
            if (payload.jti) revokeJti(payload.jti);
          }
        } catch { /* ignore */ }
      }

      await setRefreshToken(req.user!.id, null);

      logSecurityEvent({
        type: 'logout',
        severity: 'info',
        ip: req.ip,
        userId: req.user!.id,
        email: req.user!.email,
        route: '/api/auth/logout',
      });

      res.json({ success: true, message: 'Logged out' });
    } catch {
      // Idempotent — return success even on DB error
      res.json({ success: true, message: 'Logged out' });
    }
  });

// ── POST /api/auth/logout-all ───────────────────────────────────────────────
// Revoke ALL active sessions for the current user.

router.post('/logout-all', requireAuth as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await setRefreshToken(req.user!.id, null);

      logSecurityEvent({
        type: 'logout_all',
        severity: 'info',
        ip: req.ip,
        userId: req.user!.id,
        email: req.user!.email,
        route: '/api/auth/logout-all',
      });

      res.json({ success: true, message: 'All sessions revoked' });
    } catch (err) {
      const e = err as Error;
      res.status(500).json({ success: false, error: e.message });
    }
  });

export default router;
