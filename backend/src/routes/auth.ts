import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authRateLimiter } from '../middleware/rateLimiter';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import {
  findUserByEmail,
  findUserById,
  createUser,
  setRefreshToken,
  getTodayUsage,
  getDailyLimit,
  type Plan,
} from '../services/userService';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];
const JWT_REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as jwt.SignOptions['expiresIn'];

function signTokens(userId: string, email: string, name: string, plan: string) {
  const payload = { id: userId, email, name, plan };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ id: userId }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post('/register', authRateLimiter, async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ success: false, error: 'email, password, and name are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
  }
  try {
    const user = await createUser({ email, password, name });
    const { accessToken, refreshToken } = signTokens(user.id, user.email, user.name, user.plan);
    await setRefreshToken(user.id, refreshToken);
    res.status(201).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
      },
    });
  } catch (err) {
    const e = err as Error;
    const status = e.message === 'Email already in use' ? 409 : 500;
    res.status(status).json({ success: false, error: e.message });
  }
});

// POST /api/auth/login
router.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'email and password are required' });
  }
  try {
    const user = await findUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const { accessToken, refreshToken } = signTokens(user.id, user.email, user.name, user.plan);
    await setRefreshToken(user.id, refreshToken);

    const used = await getTodayUsage(user.id);
    const limit = getDailyLimit(user.plan as Plan);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
        quota: { used, limit, remaining: Math.max(0, limit - used) },
      },
    });
  } catch (err) {
    const e = err as Error;
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ success: false, error: 'refreshToken is required' });
  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { id: string };
    const user = await findUserById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }
    const tokens = signTokens(user.id, user.email, user.name, user.plan);
    await setRefreshToken(user.id, tokens.refreshToken);
    res.json({ success: true, data: tokens });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await findUserById(req.user!.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
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
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await setRefreshToken(req.user!.id, null);
  } catch {
    // best-effort
  }
  res.json({ success: true, message: 'Logged out' });
});

export default router;
