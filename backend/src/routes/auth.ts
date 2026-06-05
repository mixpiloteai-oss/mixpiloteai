// ============================================================
// NEUROTEK AI — Auth Routes (Production-Grade)
//
// Endpoints:
//   POST /register          — create account
//   POST /login             — authenticate
//   POST /refresh           — rotate refresh token
//   GET  /me                — current user profile
//   POST /logout            — revoke current session
//   POST /logout-all        — revoke all sessions
//   POST /forgot-password   — send password reset email
//   POST /reset-password    — apply new password (with token)
//   POST /verify-email      — confirm email address (with token)
//   POST /resend-verification — resend verification email
//   GET  /sessions          — list active device sessions
//   DELETE /sessions/:id    — revoke a specific session
//   DELETE /sessions        — revoke all sessions (alias)
//   POST /change-password   — change password (authenticated)
// ============================================================

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
  updatePassword,
  setEmailVerified,
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
import {
  passwordResetRepository,
  emailVerificationRepository,
  sessionRepository,
} from '../repositories/authRepository';
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendSecurityAlertEmail,
} from '../services/emailService';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// ── Device detection helper ───────────────────────────────────
function detectDevice(ua?: string): { deviceName: string; deviceType: 'browser' | 'mobile' | 'desktop' | 'api' } {
  if (!ua) return { deviceName: 'Unknown Device', deviceType: 'browser' };

  const lower = ua.toLowerCase();
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) {
    return {
      deviceName: lower.includes('iphone') ? 'iPhone' : lower.includes('android') ? 'Android' : 'Mobile',
      deviceType: 'mobile',
    };
  }
  if (lower.includes('postman') || lower.includes('curl') || lower.includes('insomnia') || lower.includes('httpie')) {
    return { deviceName: 'API Client', deviceType: 'api' };
  }
  if (lower.includes('electron')) {
    return { deviceName: 'Desktop App', deviceType: 'desktop' };
  }

  let browser = 'Browser';
  if (lower.includes('chrome') && !lower.includes('chromium')) browser = 'Chrome';
  else if (lower.includes('firefox')) browser = 'Firefox';
  else if (lower.includes('safari') && !lower.includes('chrome')) browser = 'Safari';
  else if (lower.includes('edge')) browser = 'Edge';

  let os = '';
  if (lower.includes('windows')) os = ' on Windows';
  else if (lower.includes('mac os') || lower.includes('macos')) os = ' on macOS';
  else if (lower.includes('linux')) os = ' on Linux';

  return { deviceName: `${browser}${os}`, deviceType: 'browser' };
}

// ── Token signing helper ──────────────────────────────────────

async function signTokenPairAndSession(
  userId: string,
  email: string,
  name: string,
  plan: string,
  req: Request,
  family?: string,
): Promise<{ accessToken: string; refreshToken: string; refreshTokenHash: string; family: string; sessionId: string }> {
  const accessToken = signAccessToken({ id: userId, email, name, plan });
  const { token: refreshToken, family: fam, jti: _jti } = signRefreshToken(userId, family);
  const refreshTokenHash = hashRefreshToken(refreshToken);

  // Get refresh token expiry (default 30d)
  const expiryMs = parseDuration(process.env.REFRESH_EXPIRES_IN ?? '30d');
  const expiresAt = new Date(Date.now() + expiryMs);

  const { deviceName, deviceType } = detectDevice(req.headers['user-agent']);

  const sessionId = await sessionRepository.create({
    userId,
    refreshTokenHash,
    familyId: fam,
    deviceName,
    deviceType,
    ipAddress: req.ip ?? req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
    expiresAt,
  });

  return { accessToken, refreshToken, refreshTokenHash, family: fam, sessionId };
}

/** Parse duration string (e.g. "30d", "7h", "15m") to milliseconds */
function parseDuration(d: string): number {
  const n = parseInt(d, 10);
  if (d.endsWith('d')) return n * 86_400_000;
  if (d.endsWith('h')) return n * 3_600_000;
  if (d.endsWith('m')) return n * 60_000;
  return n * 1000;
}

// ══════════════════════════════════════════════════════════════
// POST /api/auth/register
// ══════════════════════════════════════════════════════════════

router.post('/register', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  if (!validate(req, res, {
    email:    { required: true, type: 'email' },
    password: { required: true, type: 'string', min: 8, max: 200 },
    name:     { required: true, type: 'string', min: 1, max: 120 },
  })) return;

  const { email, password, name } = req.body as { email: string; password: string; name: string };
  try {
    const user = await createUser({ email, password, name });
    const tokens = await signTokenPairAndSession(user.id, user.email, user.name, user.plan, req);
    // Also keep single refresh_token on user row for backward compat
    await setRefreshToken(user.id, tokens.refreshTokenHash);

    // Send verification email (fire-and-forget — never block registration)
    emailVerificationRepository.create(user.id, user.email)
      .then(vToken => sendVerificationEmail(user.email, vToken))
      .catch(() => {}); // best-effort

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
        sessionId:    tokens.sessionId,
        user: { id: user.id, email: user.email, name: user.name, plan: user.plan, emailVerified: false },
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
}));

// ══════════════════════════════════════════════════════════════
// POST /api/auth/login
// ══════════════════════════════════════════════════════════════

router.post('/login', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
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

  const user = await findUserByEmail(email);

  // Constant-time hash compare (prevents email enumeration via timing)
  const hashToCheck = user?.passwordHash ?? '$2a$10$DUMMYHASHFORTIMINGRESISTANCEXXXXXXXXXXXXXXXXXXX.';
  const valid = await bcrypt.compare(password, hashToCheck);
  if (!user) await bcrypt.compare(password, hashToCheck).catch(() => false); // burn cycle

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

  const tokens = await signTokenPairAndSession(user.id, user.email, user.name, user.plan, req);
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
      sessionId:    tokens.sessionId,
      user:  { id: user.id, email: user.email, name: user.name, plan: user.plan },
      quota: { used, limit, remaining: Math.max(0, limit - used) },
    },
  });
}));

// ══════════════════════════════════════════════════════════════
// POST /api/auth/refresh
// ══════════════════════════════════════════════════════════════

router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken || typeof refreshToken !== 'string') {
    res.status(400).json({ success: false, error: 'refreshToken is required' });
    return;
  }

  // 1. Verify JWT signature / expiry
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

  // 2. Check session table (DB-backed multi-device)
  const tokenHash = hashRefreshToken(refreshToken);
  const session = await sessionRepository.findByTokenHash(tokenHash);

  if (!session) {
    // Session not found — check if it's a token reuse (replay / theft)
    // Look for any session in the same family
    const familySessions = await sessionRepository.findByFamily(payload.family);
    if (familySessions.length > 0) {
      // Family exists but this token is gone → token was already rotated → THEFT suspected
      await sessionRepository.revokeFamily(payload.family);
      revokeJti(payload.jti);
      logSecurityEvent({
        type: 'invalid_token',
        severity: 'critical',
        ip: req.ip,
        userId: payload.id,
        route: '/api/auth/refresh',
        reason: 'refresh token reuse detected — possible theft, family revoked',
      });
      res.status(401).json({ success: false, error: 'Session compromised. Please log in again.', code: 'SESSION_COMPROMISED' });
      return;
    }

    // Family also gone — fall back to single-token check on users table
    const user = await findUserById(payload.id);
    if (!user?.refreshToken || !verifyRefreshTokenHash(refreshToken, user.refreshToken)) {
      logSecurityEvent({ type: 'invalid_token', severity: 'warn', ip: req.ip, route: '/api/auth/refresh', reason: 'no session found' });
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
      return;
    }

    // Legacy single-token path (no session table) — issue new tokens
    revokeJti(payload.jti);
    const newTokens = await signTokenPairAndSession(user.id, user.email, user.name, user.plan, req, payload.family);
    await setRefreshToken(user.id, newTokens.refreshTokenHash);
    res.json({ success: true, data: { accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken } });
    return;
  }

  // 3. Load user
  const user = await findUserById(payload.id);
  if (!user) {
    await sessionRepository.revokeById(session.id, 'user-deleted');
    res.status(401).json({ success: false, error: 'User not found' });
    return;
  }

  // 4. Rotate: revoke old session, create new session
  await sessionRepository.revokeByTokenHash(tokenHash, 'rotation');
  revokeJti(payload.jti);

  const newTokens = await signTokenPairAndSession(user.id, user.email, user.name, user.plan, req, payload.family);
  await setRefreshToken(user.id, newTokens.refreshTokenHash); // keep user row in sync

  logSecurityEvent({ type: 'auth_success', severity: 'info', ip: req.ip, userId: user.id, route: '/api/auth/refresh' });

  res.json({
    success: true,
    data: { accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken, sessionId: newTokens.sessionId },
  });
}));

// ══════════════════════════════════════════════════════════════
// GET /api/auth/me
// ══════════════════════════════════════════════════════════════

router.get('/me', requireAuth as unknown as (req: Request, res: Response, next: () => void) => void,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
  })
);

// ══════════════════════════════════════════════════════════════
// POST /api/auth/logout
// ══════════════════════════════════════════════════════════════

router.post('/logout', requireAuth as unknown as (req: Request, res: Response, next: () => void) => void,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        const token = auth.slice(7);
        try {
          const segments = token.split('.');
          if (segments.length === 3) {
            const pl = JSON.parse(Buffer.from(segments[1]!, 'base64url').toString());
            if (pl.jti) revokeJti(pl.jti);
          }
        } catch { /* ignore */ }
      }

      // Revoke the refresh token passed in body (if provided)
      const { refreshToken } = req.body as { refreshToken?: string };
      if (refreshToken) {
        const tokenHash = hashRefreshToken(refreshToken);
        await sessionRepository.revokeByTokenHash(tokenHash, 'logout');
      }

      await setRefreshToken(req.user!.id, null);

      logSecurityEvent({ type: 'logout', severity: 'info', ip: req.ip, userId: req.user!.id, email: req.user!.email, route: '/api/auth/logout' });
      res.json({ success: true, message: 'Logged out' });
    } catch {
      res.json({ success: true, message: 'Logged out' }); // idempotent
    }
  })
);

// ══════════════════════════════════════════════════════════════
// POST /api/auth/logout-all
// ══════════════════════════════════════════════════════════════

router.post('/logout-all', requireAuth as unknown as (req: Request, res: Response, next: () => void) => void,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await sessionRepository.revokeAll(req.user!.id, 'logout-all');
    await setRefreshToken(req.user!.id, null);
    logSecurityEvent({ type: 'logout_all', severity: 'info', ip: req.ip, userId: req.user!.id, email: req.user!.email, route: '/api/auth/logout-all' });
    res.json({ success: true, message: 'All sessions revoked' });
  })
);

// ══════════════════════════════════════════════════════════════
// POST /api/auth/forgot-password
// Anti-flood: max 3 valid tokens per email per hour
// Always returns 200 — never reveals whether email exists (no enumeration)
// ══════════════════════════════════════════════════════════════

router.post('/forgot-password', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  if (!validate(req, res, { email: { required: true, type: 'email' } })) return;

  const { email } = req.body as { email: string };
  const emailLower = email.toLowerCase().trim();

  // Always respond with 200 regardless of whether email exists
  const genericResponse = { success: true, message: 'If that email exists, you will receive a reset link shortly.' };

  // Anti-flood: max 3 reset emails per address per hour
  const recentCount = await passwordResetRepository.countRecentForEmail(emailLower);
  if (recentCount >= 3) {
    // Log the flood attempt but respond with 200 (no enumeration)
    logSecurityEvent({
      type: 'auth_failure',
      severity: 'warn',
      ip: req.ip,
      email: emailLower,
      route: '/api/auth/forgot-password',
      reason: 'email flood limit',
    });
    res.json(genericResponse);
    return;
  }

  const user = await findUserByEmail(emailLower);
  if (!user) {
    // Respond as if success — never enumerate user existence
    res.json(genericResponse);
    return;
  }

  // Generate reset token and send email (fire-and-forget — never block response)
  try {
    const token = await passwordResetRepository.create(user.id, user.email, req.ip);
    await sendPasswordResetEmail(user.email, token, 60);
    logSecurityEvent({
      type: 'auth_success',
      severity: 'info',
      ip: req.ip,
      userId: user.id,
      email: user.email,
      route: '/api/auth/forgot-password',
      reason: 'reset email sent',
    });
  } catch (err) {
    logSecurityEvent({
      type: 'auth_failure',
      severity: 'critical',
      ip: req.ip,
      email: emailLower,
      route: '/api/auth/forgot-password',
      reason: `send failed: ${(err as Error).message}`,
    });
  }

  res.json(genericResponse);
}));

// ══════════════════════════════════════════════════════════════
// POST /api/auth/reset-password
// Validate token → set new password → revoke all sessions → send security alert
// ══════════════════════════════════════════════════════════════

router.post('/reset-password', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  if (!validate(req, res, {
    token:    { required: true, type: 'string', min: 32, max: 128 },
    password: { required: true, type: 'string', min: 8, max: 200 },
  })) return;

  const { token, password } = req.body as { token: string; password: string };

  // Find the token (validates: exists, unexpired, unused)
  const record = await passwordResetRepository.findValid(token);
  if (!record) {
    logSecurityEvent({
      type: 'auth_failure',
      severity: 'warn',
      ip: req.ip,
      route: '/api/auth/reset-password',
      reason: 'invalid or expired token',
    });
    res.status(400).json({ success: false, error: 'Token is invalid or has expired', code: 'INVALID_RESET_TOKEN' });
    return;
  }

  // Mark token as used FIRST (before any state change — one-time use guarantee)
  await passwordResetRepository.markUsed(record.tokenHash);

  // Update password
  await updatePassword(record.userId, password);

  // Revoke ALL sessions (security: force re-login on all devices)
  await sessionRepository.revokeAll(record.userId, 'password-reset');
  await setRefreshToken(record.userId, null);

  // Send security alert email (fire-and-forget)
  const user = await findUserById(record.userId);
  if (user) {
    sendSecurityAlertEmail(
      user.email,
      'Password Changed',
      req.ip ?? 'unknown',
      'Your password was reset. All active sessions have been signed out.',
    ).catch(() => {});
  }

  logSecurityEvent({
    type: 'auth_success',
    severity: 'info',
    ip: req.ip,
    userId: record.userId,
    email: record.email,
    route: '/api/auth/reset-password',
    reason: 'password reset successful',
  });

  res.json({ success: true, message: 'Password updated. Please log in with your new password.' });
}));

// ══════════════════════════════════════════════════════════════
// POST /api/auth/verify-email
// ══════════════════════════════════════════════════════════════

router.post('/verify-email', asyncHandler(async (req: Request, res: Response) => {
  if (!validate(req, res, { token: { required: true, type: 'string', min: 32, max: 128 } })) return;

  const { token } = req.body as { token: string };
  const record = await emailVerificationRepository.findValid(token);

  if (!record) {
    res.status(400).json({ success: false, error: 'Verification link is invalid or has expired', code: 'INVALID_VERIFY_TOKEN' });
    return;
  }

  await emailVerificationRepository.markUsed(record.tokenHash);
  await setEmailVerified(record.userId);

  logSecurityEvent({
    type: 'auth_success',
    severity: 'info',
    ip: req.ip,
    userId: record.userId,
    email: record.email,
    route: '/api/auth/verify-email',
    reason: 'email verified',
  });

  res.json({ success: true, message: 'Email verified successfully.' });
}));

// ══════════════════════════════════════════════════════════════
// POST /api/auth/resend-verification
// Anti-flood: max 3 sends per user per hour
// ══════════════════════════════════════════════════════════════

router.post('/resend-verification',
  authRateLimiter,
  requireAuth as unknown as (req: Request, res: Response, next: () => void) => void,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const email  = req.user!.email;

    const recentCount = await emailVerificationRepository.countRecentForUser(userId);
    if (recentCount >= 3) {
      res.status(429).json({
        success: false,
        error: 'Too many verification emails sent. Please wait before trying again.',
        code: 'VERIFICATION_RATE_LIMITED',
      });
      return;
    }

    const token = await emailVerificationRepository.create(userId, email);
    await sendVerificationEmail(email, token);

    res.json({ success: true, message: 'Verification email sent.' });
  })
);

// ══════════════════════════════════════════════════════════════
// GET /api/auth/sessions
// List all active device sessions for current user
// ══════════════════════════════════════════════════════════════

router.get('/sessions',
  requireAuth as unknown as (req: Request, res: Response, next: () => void) => void,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const sessions = await sessionRepository.findByUser(req.user!.id);

    const data = sessions.map(s => ({
      id:          s.id,
      deviceName:  s.deviceName ?? 'Unknown Device',
      deviceType:  s.deviceType,
      ipAddress:   s.ipAddress ? s.ipAddress.replace(/\.\d+$/, '.xxx') : null, // partial IP masking
      lastSeenAt:  s.lastSeenAt,
      createdAt:   s.createdAt,
      expiresAt:   s.expiresAt,
    }));

    res.json({ success: true, data, count: data.length });
  })
);

// ══════════════════════════════════════════════════════════════
// DELETE /api/auth/sessions/:id
// Revoke a specific device session
// ══════════════════════════════════════════════════════════════

router.delete('/sessions/:id',
  requireAuth as unknown as (req: Request, res: Response, next: () => void) => void,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const sessionId = req.params['id'];
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Session ID required' });
      return;
    }

    // Verify the session belongs to this user before revoking
    const sessions = await sessionRepository.findByUser(req.user!.id);
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    await sessionRepository.revokeById(sessionId, 'user-revoked');

    logSecurityEvent({
      type: 'logout',
      severity: 'info',
      ip: req.ip,
      userId: req.user!.id,
      route: `/api/auth/sessions/${sessionId}`,
      reason: 'session revoked by user',
    });

    res.json({ success: true, message: 'Session revoked' });
  })
);

// ══════════════════════════════════════════════════════════════
// DELETE /api/auth/sessions
// Revoke ALL sessions (alias for logout-all without body)
// ══════════════════════════════════════════════════════════════

router.delete('/sessions',
  requireAuth as unknown as (req: Request, res: Response, next: () => void) => void,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const count = await sessionRepository.revokeAll(req.user!.id, 'logout-all');
    await setRefreshToken(req.user!.id, null);

    logSecurityEvent({
      type: 'logout_all',
      severity: 'info',
      ip: req.ip,
      userId: req.user!.id,
      email: req.user!.email,
      route: '/api/auth/sessions (DELETE)',
    });

    res.json({ success: true, message: `${count} session(s) revoked` });
  })
);

// ══════════════════════════════════════════════════════════════
// POST /api/auth/change-password
// Authenticated password change (requires current password)
// ══════════════════════════════════════════════════════════════

router.post('/change-password',
  authRateLimiter,
  requireAuth as unknown as (req: Request, res: Response, next: () => void) => void,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!validate(req, res, {
      currentPassword: { required: true, type: 'string', min: 1,  max: 200 },
      newPassword:     { required: true, type: 'string', min: 8,  max: 200 },
    })) return;

    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    const user = await findUserById(req.user!.id);

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      recordFailure(user.email);
      logSecurityEvent({
        type: 'auth_failure',
        severity: 'warn',
        ip: req.ip,
        userId: user.id,
        email: user.email,
        route: '/api/auth/change-password',
        reason: 'wrong current password',
      });
      res.status(401).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    await updatePassword(user.id, newPassword);

    // Revoke all OTHER sessions (keep current session active)
    await sessionRepository.revokeAll(user.id, 'password-changed');
    await setRefreshToken(user.id, null);

    // Send security alert
    sendSecurityAlertEmail(
      user.email,
      'Password Changed',
      req.ip ?? 'unknown',
      'Your password was changed. All other sessions have been signed out.',
    ).catch(() => {});

    logSecurityEvent({
      type: 'auth_success',
      severity: 'info',
      ip: req.ip,
      userId: user.id,
      email: user.email,
      route: '/api/auth/change-password',
      reason: 'password changed',
    });

    res.json({ success: true, message: 'Password updated. Other sessions have been revoked.' });
  })
);

export default router;
