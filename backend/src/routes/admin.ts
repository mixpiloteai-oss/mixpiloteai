// ============================================================
// NEUROTEK AI — Admin Routes (production)
// ============================================================
import { Router, Request, Response } from 'express';
import {
  requireAdmin,
  requireSuperAdmin,
  AdminRequest,
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  verifyAdminCredentials,
  isIPBlocked,
  recordLoginFailure,
  recordLoginSuccess,
  SUPER_ADMIN_EMAILS,
} from '../middleware/adminAuth';
import {
  getPlatformStats,
  getRealPlatformStats,
  getUsers,
  getUser,
  banUser,
  banUserReal,
  unbanUser,
  unbanUserReal,
  getBans,
  deleteUser,
  deleteUserReal,
  getRealUsers,
  getRealUserById,
  getUserActivity,
  getTickets,
  getTicket,
  replyTicket,
  updateTicketStatus,
  assignTicket,
  getMarketplaceItems,
  approveProduct,
  rejectProduct,
  deleteProduct,
  getAIStats,
  getUserHistory,
  getStats,
  listCoupons,
  logAdminAction,
  getAdminLogs,
  SupportTicket,
} from '../services/adminService';
import {
  getMetrics,
  getLatestMetric,
  getServiceStatuses,
  getAlertRules,
  getErrorLogs,
  getStorageInfo,
} from '../services/monitoringService';
import { getCoupon } from '../services/couponService';
import { logger } from '../utils/logger';
import { getPlans, getPlan, updatePlan, createPlan, togglePlan } from '../lib/planManager';
import { getCreditPacks, getCreditPack, updateCreditPack, toggleCreditPack } from '../lib/creditPackManager';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// ── Cast helper ───────────────────────────────────────────────
function asAdmin(req: Request): AdminRequest {
  return req as AdminRequest;
}

// ── Stripe config ─────────────────────────────────────────────
const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const IS_STRIPE_MOCK = !STRIPE_SECRET_KEY || STRIPE_SECRET_KEY === 'sk_test_placeholder';

async function stripeGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params
    ? `${STRIPE_API}${path}?${new URLSearchParams(params).toString()}`
    : `${STRIPE_API}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(`Stripe GET ${path} failed (${res.status}): ${err?.error?.message ?? 'unknown'}`);
  }
  return res.json() as Promise<T>;
}

async function stripePost<T>(path: string, body?: Record<string, string>): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(`Stripe POST ${path} failed (${res.status}): ${err?.error?.message ?? 'unknown'}`);
  }
  return res.json() as Promise<T>;
}

async function stripeDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(`Stripe DELETE ${path} failed (${res.status}): ${err?.error?.message ?? 'unknown'}`);
  }
  return res.json() as Promise<T>;
}

// ══════════════════════════════════════════════════════════════
// AUTH ENDPOINTS — public (no requireAdmin middleware)
// ══════════════════════════════════════════════════════════════

router.post('/auth/login', async (req: Request, res: Response): Promise<void> => {
  const ip = req.ip ?? '0.0.0.0';
  const userAgent = req.headers['user-agent'] ?? '';

  if (isIPBlocked(ip)) {
    res.status(429).json({ success: false, error: 'Too many failed attempts. Try again in 30 minutes.' });
    return;
  }

  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'email and password are required' });
    return;
  }

  try {
    const admin = await verifyAdminCredentials(email, password);
    if (!admin) {
      const result = recordLoginFailure(ip);
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        remainingAttempts: result.remainingAttempts,
        blocked: result.blocked,
      });
      return;
    }

    recordLoginSuccess(ip);

    const payload = { id: admin.id, email: admin.email, role: admin.role };
    const accessToken  = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await storeRefreshToken(refreshToken, admin.id, admin.email, admin.role, ip, userAgent);
    await logAdminAction(admin.email, 'login', 'auth', ip, admin.id);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: { id: admin.id, email: admin.email, role: admin.role },
      },
    });
  } catch (err) {
    logger.error('[admin/auth/login]', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

router.post('/auth/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ success: false, error: 'refreshToken is required' });
    return;
  }
  try {
    const session = await validateRefreshToken(refreshToken);
    if (!session) {
      res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
      return;
    }
    const role = SUPER_ADMIN_EMAILS.has(session.adminEmail) ? 'super_admin' as const : 'admin' as const;
    const accessToken = signAccessToken({ id: session.adminId, email: session.adminEmail, role });
    res.json({ success: true, data: { accessToken } });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});

router.post('/auth/logout', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    try { await revokeRefreshToken(refreshToken); } catch { /* ignore */ }
  }
  res.json({ success: true });
});

router.get('/auth/me', (req: Request, res: Response): void => {
  requireAdmin(asAdmin(req), res, () => {
    const admin = asAdmin(req);
    res.json({
      success: true,
      data: { id: admin.adminId, email: admin.adminEmail, role: admin.adminRole },
    });
  });
});

// ── All remaining routes require at minimum admin role ────────
router.use((req: Request, res: Response, next) => {
  requireAdmin(asAdmin(req), res, next);
});

// ══════════════════════════════════════════════════════════════
// Overview / Stats
// ══════════════════════════════════════════════════════════════

router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await getRealPlatformStats();
    res.json({ success: true, data });
  } catch {
    res.json({ success: true, data: getPlatformStats() });
  }
});

// ══════════════════════════════════════════════════════════════
// Monitoring
// ══════════════════════════════════════════════════════════════

router.get('/monitoring', async (_req: Request, res: Response): Promise<void> => {
  const services = await getServiceStatuses();
  res.json({
    success: true,
    data: {
      latest: getLatestMetric(),
      metrics: getMetrics(30),
      services,
    },
  });
});

router.get('/monitoring/metrics', (req: Request, res: Response) => {
  const last = req.query['last'] ? Number(req.query['last']) : 30;
  res.json({ success: true, data: getMetrics(last) });
});

router.get('/monitoring/errors', (req: Request, res: Response) => {
  const limit = req.query['limit'] ? Number(req.query['limit']) : 50;
  res.json({ success: true, data: getErrorLogs(limit) });
});

router.get('/monitoring/storage', (_req: Request, res: Response) => {
  res.json({ success: true, data: getStorageInfo() });
});

router.get('/monitoring/alerts', (_req: Request, res: Response) => {
  res.json({ success: true, data: getAlertRules() });
});

// ══════════════════════════════════════════════════════════════
// SSE Live Metrics (Task 4)
// ══════════════════════════════════════════════════════════════

router.get('/live', async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  function randBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function send(eventType: string, data: unknown): void {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // Emit metrics every 5 seconds
  const metricsInterval = setInterval(() => {
    send('metrics', {
      cpu: Math.round(randBetween(15, 75) * 10) / 10,
      ram: {
        used: Math.round(randBetween(2.1, 3.5) * 100) / 100,
        total: 8,
      },
      activeConnections: Math.floor(randBetween(40, 120)),
      requestsPerMinute: Math.floor(randBetween(80, 400)),
      timestamp: Date.now(),
    });
  }, 5000);

  // Emit platform stats every 30 seconds
  const statsInterval = setInterval(async () => {
    try {
      const stats = await getRealPlatformStats();
      send('stats', stats);
    } catch {
      send('stats', getPlatformStats());
    }
  }, 30000);

  // Keepalive comment every 25 seconds
  const keepaliveInterval = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 25000);

  // Send initial metrics right away
  send('metrics', {
    cpu: Math.round(randBetween(15, 75) * 10) / 10,
    ram: { used: Math.round(randBetween(2.1, 3.5) * 100) / 100, total: 8 },
    activeConnections: Math.floor(randBetween(40, 120)),
    requestsPerMinute: Math.floor(randBetween(80, 400)),
    timestamp: Date.now(),
  });

  req.on('close', () => {
    clearInterval(metricsInterval);
    clearInterval(statsInterval);
    clearInterval(keepaliveInterval);
  });
});

// ══════════════════════════════════════════════════════════════
// Users
// ══════════════════════════════════════════════════════════════

router.get('/users', async (req: Request, res: Response): Promise<void> => {
  const { search, plan, sort, page, limit } = req.query;
  const banned = req.query['banned'] !== undefined
    ? req.query['banned'] === 'true'
    : undefined;

  try {
    // Use real Supabase users when possible; if banned filter or sort requested, fall back to mock
    if (banned !== undefined || sort) {
      const result = getUsers({
        search: typeof search === 'string' ? search : undefined,
        plan: typeof plan === 'string' ? plan : undefined,
        banned,
        sort: typeof sort === 'string' ? sort : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ success: true, ...result });
      return;
    }
    const result = await getRealUsers(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      typeof search === 'string' ? search : undefined,
      typeof plan === 'string' ? plan : undefined
    );
    res.json({ success: true, users: result.users, total: result.total });
  } catch {
    const result = getUsers({
      search: typeof search === 'string' ? search : undefined,
      plan: typeof plan === 'string' ? plan : undefined,
      banned,
      sort: typeof sort === 'string' ? sort : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ success: true, ...result });
  }
});

router.get('/users/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getRealUserById(req.params['id'] ?? '');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch {
    const user = getUser(req.params['id'] ?? '');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  }
});

router.get('/users/:id/activity', async (req: Request, res: Response): Promise<void> => {
  try {
    const activity = await getUserActivity(req.params['id'] ?? '');
    res.json({ success: true, data: activity });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user activity' });
  }
});

router.delete('/users/:id', (req: Request, res: Response): void => {
  requireSuperAdmin(asAdmin(req), res, async () => {
    try {
      const ok = await deleteUserReal(req.params['id'] ?? '', asAdmin(req).adminId);
      if (!ok) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }
      await logAdminAction(
        asAdmin(req).adminEmail,
        'delete_user',
        req.params['id'] ?? '',
        req.ip ?? '0.0.0.0',
        asAdmin(req).adminId
      );
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
  });
});

router.post('/users/:id/ban', (req: Request, res: Response): void => {
  const { reason, expiresAt } = req.body as { reason?: string; expiresAt?: number };
  if (!reason) {
    res.status(400).json({ success: false, error: 'reason is required' });
    return;
  }
  banUserReal(req.params['id'] ?? '', reason, asAdmin(req).adminId, expiresAt)
    .then((record) => {
      return logAdminAction(
        asAdmin(req).adminEmail,
        'ban_user',
        req.params['id'] ?? '',
        req.ip ?? '0.0.0.0',
        asAdmin(req).adminId
      ).then(() => res.json({ success: true, data: record }));
    })
    .catch(() => res.status(500).json({ success: false, error: 'Failed to ban user' }));
});

router.post('/users/:id/unban', (req: Request, res: Response): void => {
  unbanUserReal(req.params['id'] ?? '')
    .then((ok) => {
      if (!ok) {
        res.status(404).json({ success: false, error: 'No active ban found for user' });
        return;
      }
      return logAdminAction(
        asAdmin(req).adminEmail,
        'unban_user',
        req.params['id'] ?? '',
        req.ip ?? '0.0.0.0',
        asAdmin(req).adminId
      ).then(() => res.json({ success: true }));
    })
    .catch(() => res.status(500).json({ success: false, error: 'Failed to unban user' }));
});

router.get('/bans', (req: Request, res: Response) => {
  const activeParam = req.query['active'];
  const active = activeParam !== undefined ? activeParam === 'true' : undefined;
  res.json({ success: true, data: getBans(active) });
});

// ══════════════════════════════════════════════════════════════
// Admin Logs
// ══════════════════════════════════════════════════════════════

router.get('/logs', async (req: Request, res: Response): Promise<void> => {
  const limit = req.query['limit'] ? Number(req.query['limit']) : 50;
  try {
    const logs = await getAdminLogs(limit);
    res.json({ success: true, data: logs });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
});

// ══════════════════════════════════════════════════════════════
// Marketplace
// ══════════════════════════════════════════════════════════════

router.get('/marketplace', (req: Request, res: Response) => {
  const { status, category } = req.query;
  const items = getMarketplaceItems({
    status: typeof status === 'string' ? status : undefined,
    category: typeof category === 'string' ? category : undefined,
  });
  res.json({ success: true, data: items, total: items.length });
});

router.post('/marketplace/:id/approve', async (req: Request, res: Response): Promise<void> => {
  const ok = approveProduct(req.params['id'] ?? '', asAdmin(req).adminId);
  if (!ok) {
    res.status(404).json({ success: false, error: 'Product not found' });
    return;
  }
  await logAdminAction(asAdmin(req).adminEmail, 'approve_product', req.params['id'] ?? '', req.ip ?? '0.0.0.0', asAdmin(req).adminId);
  res.json({ success: true });
});

router.post('/marketplace/:id/reject', async (req: Request, res: Response): Promise<void> => {
  const { reason } = req.body as { reason?: string };
  if (!reason) {
    res.status(400).json({ success: false, error: 'reason is required' });
    return;
  }
  const ok = rejectProduct(req.params['id'] ?? '', reason, asAdmin(req).adminId);
  if (!ok) {
    res.status(404).json({ success: false, error: 'Product not found' });
    return;
  }
  await logAdminAction(asAdmin(req).adminEmail, 'reject_product', req.params['id'] ?? '', req.ip ?? '0.0.0.0', asAdmin(req).adminId);
  res.json({ success: true });
});

router.delete('/marketplace/:id', (req: Request, res: Response): void => {
  requireSuperAdmin(asAdmin(req), res, async () => {
    const ok = deleteProduct(req.params['id'] ?? '', asAdmin(req).adminId);
    if (!ok) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    await logAdminAction(asAdmin(req).adminEmail, 'delete_product', req.params['id'] ?? '', req.ip ?? '0.0.0.0', asAdmin(req).adminId);
    res.json({ success: true });
  });
});

// ══════════════════════════════════════════════════════════════
// Support Tickets
// ══════════════════════════════════════════════════════════════

router.get('/tickets', (req: Request, res: Response) => {
  const { status, priority, category } = req.query;
  const list = getTickets({
    status: typeof status === 'string' ? status : undefined,
    priority: typeof priority === 'string' ? priority : undefined,
    category: typeof category === 'string' ? category : undefined,
  });
  res.json({ success: true, data: list, total: list.length });
});

router.get('/tickets/:id', (req: Request, res: Response) => {
  const ticket = getTicket(req.params['id'] ?? '');
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }
  res.json({ success: true, data: ticket });
});

router.post('/tickets/:id/reply', async (req: Request, res: Response): Promise<void> => {
  const { text } = req.body as { text?: string };
  if (!text) {
    res.status(400).json({ success: false, error: 'text is required' });
    return;
  }
  const ticket = replyTicket(req.params['id'] ?? '', asAdmin(req).adminId, text);
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }
  await logAdminAction(asAdmin(req).adminEmail, 'reply_ticket', req.params['id'] ?? '', req.ip ?? '0.0.0.0', asAdmin(req).adminId);
  res.json({ success: true, data: ticket });
});

router.patch('/tickets/:id/status', (req: Request, res: Response) => {
  const { status } = req.body as { status?: SupportTicket['status'] };
  if (!status) {
    res.status(400).json({ success: false, error: 'status is required' });
    return;
  }
  const ticket = updateTicketStatus(req.params['id'] ?? '', status);
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }
  res.json({ success: true, data: ticket });
});

router.post('/tickets/:id/assign', (req: Request, res: Response) => {
  const ticket = assignTicket(req.params['id'] ?? '', asAdmin(req).adminId);
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }
  res.json({ success: true, data: ticket });
});

// ══════════════════════════════════════════════════════════════
// Payments (legacy mock)
// ══════════════════════════════════════════════════════════════

router.get('/payments', (_req: Request, res: Response) => {
  const logs = getUserHistory('all', 100);
  res.json({ success: true, data: logs, total: logs.length });
});

router.get('/payments/stats', (_req: Request, res: Response) => {
  res.json({ success: true, data: getStats() });
});

router.post('/payments/refund', (req: Request, res: Response) => {
  const { paymentId, reason, amountCents } = req.body as {
    paymentId?: string;
    reason?: string;
    amountCents?: number;
  };
  if (!paymentId || !reason) {
    res.status(400).json({ success: false, error: 'paymentId and reason are required' });
    return;
  }
  res.json({
    success: true,
    data: {
      refundId: `ref_${Date.now()}`,
      paymentId,
      reason,
      amountCents: amountCents ?? null,
      status: 'issued',
      issuedAt: Date.now(),
    },
  });
});

// ══════════════════════════════════════════════════════════════
// Stripe Financial Endpoints (Task 3)
// ══════════════════════════════════════════════════════════════

// Mock Stripe data helpers
function getMockCharges(): Array<{
  id: string; amount: number; currency: string; status: string;
  customer_email: string; created: number; description: string;
}> {
  const names = [
    'Alex Rivera', 'Jordan Lee', 'Morgan Chen', 'Taylor Kim', 'Sam Patel',
    'Chris Wu', 'Drew Santos', 'Quinn Murphy', 'Avery Brooks', 'Blake Torres',
    'Casey Johnson', 'Dana Mitchell', 'Evan Turner', 'Finley Adams', 'Gray Wallace',
    'Harper Nelson', 'Indigo Cooper', 'Jamie Reed', 'Kendall Bell', 'Logan Foster',
    'Mika Hayes', 'Noel Griffin', 'Oakley Simmons', 'Parker Long', 'Reese Howard',
  ];
  const plans = ['Pro Monthly', 'Studio Monthly', 'Pro Annual', 'Studio Annual', 'Label Monthly'];
  const amounts = [999, 2499, 7999, 19999, 9999, 499, 1999];
  const statuses = ['succeeded', 'succeeded', 'succeeded', 'succeeded', 'refunded', 'failed'];
  const now = Math.floor(Date.now() / 1000);

  return names.map((name, i) => ({
    id: `ch_mock_${(i + 1).toString().padStart(4, '0')}`,
    amount: amounts[i % amounts.length]!,
    currency: 'usd',
    status: statuses[i % statuses.length]!,
    customer_email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    created: now - i * 86400,
    description: plans[i % plans.length]!,
  }));
}

router.get('/stripe/overview', async (_req: Request, res: Response): Promise<void> => {
  if (IS_STRIPE_MOCK) {
    const charges = getMockCharges();
    const succeeded = charges.filter((c) => c.status === 'succeeded');
    const totalRevenue = succeeded.reduce((s, c) => s + c.amount, 0);
    const mrr = 18420_00; // in cents
    res.json({
      success: true,
      data: {
        balance: { available: [{ amount: 24_500_00, currency: 'usd' }], pending: [{ amount: 3_200_00, currency: 'usd' }] },
        mrr: mrr,
        arr: mrr * 12,
        totalRevenue,
        successRate: Math.round((succeeded.length / charges.length) * 100 * 10) / 10,
        activeSubscriptions: 312,
        isMock: true,
      },
    });
    return;
  }

  try {
    const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
    const [balance, charges, activeSubs] = await Promise.all([
      stripeGet<{ available: Array<{ amount: number; currency: string }>; pending: Array<{ amount: number; currency: string }> }>('/balance'),
      stripeGet<{ data: Array<{ amount: number; status: string }> }>('/charges', {
        limit: '100',
        'created[gte]': String(monthStart),
      }),
      stripeGet<{ data: Array<{ items: { data: Array<{ price: { unit_amount: number } }> } }> }>('/subscriptions', {
        status: 'active',
        limit: '100',
      }),
    ]);

    const succeeded = charges.data.filter((c) => c.status === 'succeeded');
    const totalRevenue = succeeded.reduce((s, c) => s + c.amount, 0);
    const mrr = activeSubs.data.reduce((s, sub) => {
      const amount = sub.items.data[0]?.price?.unit_amount ?? 0;
      return s + amount;
    }, 0);

    res.json({
      success: true,
      data: {
        balance,
        mrr,
        arr: mrr * 12,
        totalRevenue,
        successRate: charges.data.length > 0
          ? Math.round((succeeded.length / charges.data.length) * 100 * 10) / 10
          : 100,
        activeSubscriptions: activeSubs.data.length,
        isMock: false,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/stripe/charges', async (req: Request, res: Response): Promise<void> => {
  if (IS_STRIPE_MOCK) {
    const limit = req.query['limit'] ? Number(req.query['limit']) : 25;
    res.json({ success: true, data: getMockCharges().slice(0, limit), isMock: true });
    return;
  }

  try {
    const params: Record<string, string> = {
      limit: String(req.query['limit'] ? Number(req.query['limit']) : 25),
      expand: 'data.customer',
    };
    if (typeof req.query['starting_after'] === 'string') {
      params['starting_after'] = req.query['starting_after'];
    }

    const result = await stripeGet<{
      data: Array<{
        id: string; amount: number; currency: string; status: string;
        customer: { email?: string } | string | null;
        created: number; description: string | null;
      }>;
      has_more: boolean;
    }>('/charges', params);

    const formatted = result.data.map((c) => ({
      id: c.id,
      amount: c.amount,
      currency: c.currency,
      status: c.status,
      customer_email: typeof c.customer === 'object' && c.customer !== null
        ? c.customer.email ?? null
        : null,
      created: c.created,
      description: c.description,
    }));

    res.json({ success: true, data: formatted, has_more: result.has_more });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/stripe/subscriptions', async (req: Request, res: Response): Promise<void> => {
  if (IS_STRIPE_MOCK) {
    const subs = getMockCharges().slice(0, 10).map((c, i) => ({
      id: `sub_mock_${(i + 1).toString().padStart(4, '0')}`,
      customer_email: c.customer_email,
      plan: c.description,
      amount: c.amount,
      status: 'active',
      created: c.created,
    }));
    res.json({ success: true, data: subs, isMock: true });
    return;
  }

  try {
    const params: Record<string, string> = {
      status: 'active',
      limit: String(req.query['limit'] ? Number(req.query['limit']) : 25),
      expand: 'data.customer,data.items.data.price.product',
    };
    if (typeof req.query['starting_after'] === 'string') {
      params['starting_after'] = req.query['starting_after'];
    }

    const result = await stripeGet<{
      data: Array<{
        id: string; status: string; created: number; cancel_at_period_end: boolean;
        customer: { email?: string } | string;
        items: { data: Array<{ price: { unit_amount: number; product: { name?: string } | string } }> };
      }>;
      has_more: boolean;
    }>('/subscriptions', params);

    const formatted = result.data.map((s) => ({
      id: s.id,
      customer_email: typeof s.customer === 'object' ? (s.customer as { email?: string }).email ?? null : null,
      plan: typeof s.items.data[0]?.price?.product === 'object'
        ? (s.items.data[0].price.product as { name?: string }).name ?? null
        : null,
      amount: s.items.data[0]?.price?.unit_amount ?? 0,
      status: s.status,
      created: s.created,
      cancel_at_period_end: s.cancel_at_period_end,
    }));

    res.json({ success: true, data: formatted, has_more: result.has_more });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/stripe/refund', (req: Request, res: Response): void => {
  requireSuperAdmin(asAdmin(req), res, async () => {
    const { chargeId, amount, reason } = req.body as {
      chargeId?: string;
      amount?: number;
      reason?: string;
    };
    if (!chargeId) {
      res.status(400).json({ success: false, error: 'chargeId is required' });
      return;
    }

    await logAdminAction(asAdmin(req).adminEmail, 'stripe_refund', chargeId, req.ip ?? '0.0.0.0', asAdmin(req).adminId);

    if (IS_STRIPE_MOCK) {
      res.json({
        success: true,
        data: {
          id: `re_mock_${Date.now()}`,
          object: 'refund',
          amount: amount ?? 999,
          currency: 'usd',
          charge: chargeId,
          reason: reason ?? null,
          status: 'succeeded',
          created: Math.floor(Date.now() / 1000),
        },
        isMock: true,
      });
      return;
    }

    try {
      const params: Record<string, string> = { charge: chargeId };
      if (amount) params['amount'] = String(amount);
      if (reason) params['reason'] = reason;
      const refund = await stripePost('/refunds', params);
      res.json({ success: true, data: refund });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });
});

router.get('/stripe/coupons', async (_req: Request, res: Response): Promise<void> => {
  if (IS_STRIPE_MOCK) {
    res.json({ success: true, data: listCoupons(), isMock: true });
    return;
  }
  try {
    const result = await stripeGet<{ data: unknown[] }>('/coupons');
    res.json({ success: true, data: result.data });
  } catch {
    res.json({ success: true, data: listCoupons(), isMock: true });
  }
});

router.post('/stripe/coupons', (req: Request, res: Response): void => {
  requireSuperAdmin(asAdmin(req), res, async () => {
    const { id, percent_off, amount_off, currency, duration, max_redemptions, name } = req.body as {
      id?: string;
      percent_off?: number;
      amount_off?: number;
      currency?: string;
      duration?: string;
      max_redemptions?: number;
      name?: string;
    };

    if (IS_STRIPE_MOCK) {
      const coupon = {
        id: id ?? `cpn_admin_${Date.now()}`,
        name: name ?? id ?? 'Coupon',
        percent_off: percent_off ?? null,
        amount_off: amount_off ?? null,
        currency: currency ?? 'usd',
        duration: duration ?? 'once',
        max_redemptions: max_redemptions ?? null,
        times_redeemed: 0,
        valid: true,
        created: Math.floor(Date.now() / 1000),
      };
      await logAdminAction(asAdmin(req).adminEmail, 'create_coupon', coupon.id, req.ip ?? '0.0.0.0', asAdmin(req).adminId);
      res.status(201).json({ success: true, data: coupon, isMock: true });
      return;
    }

    try {
      const params: Record<string, string> = { duration: duration ?? 'once' };
      if (id) params['id'] = id;
      if (percent_off !== undefined) params['percent_off'] = String(percent_off);
      if (amount_off !== undefined) { params['amount_off'] = String(amount_off); params['currency'] = currency ?? 'usd'; }
      if (max_redemptions !== undefined) params['max_redemptions'] = String(max_redemptions);
      if (name) params['name'] = name;
      const coupon = await stripePost('/coupons', params);
      await logAdminAction(asAdmin(req).adminEmail, 'create_coupon', (coupon as { id: string }).id, req.ip ?? '0.0.0.0', asAdmin(req).adminId);
      res.status(201).json({ success: true, data: coupon });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });
});

router.delete('/stripe/coupons/:id', (req: Request, res: Response): void => {
  requireSuperAdmin(asAdmin(req), res, async () => {
    const couponId = req.params['id'] ?? '';

    if (IS_STRIPE_MOCK) {
      await logAdminAction(asAdmin(req).adminEmail, 'delete_coupon', couponId, req.ip ?? '0.0.0.0', asAdmin(req).adminId);
      res.json({ success: true, data: { id: couponId, deleted: true }, isMock: true });
      return;
    }

    try {
      const result = await stripeDelete(`/coupons/${couponId}`);
      await logAdminAction(asAdmin(req).adminEmail, 'delete_coupon', couponId, req.ip ?? '0.0.0.0', asAdmin(req).adminId);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });
});

// ══════════════════════════════════════════════════════════════
// AI
// ══════════════════════════════════════════════════════════════

// Seeded model state
const aiModels: { id: string; name: string; provider: string; enabled: boolean; costPer1k: number }[] = [
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', enabled: true, costPer1k: 0.003 },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', enabled: true, costPer1k: 0.015 },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic', enabled: true, costPer1k: 0.00025 },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', enabled: false, costPer1k: 0.005 },
  { id: 'gemini-1-5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', enabled: false, costPer1k: 0.0035 },
];

router.get('/ai/stats', (_req: Request, res: Response) => {
  res.json({ success: true, data: getAIStats() });
});

router.get('/ai/models', (_req: Request, res: Response) => {
  res.json({ success: true, data: aiModels });
});

router.patch('/ai/models/:id', (req: Request, res: Response) => {
  const model = aiModels.find((m) => m.id === req.params['id']);
  if (!model) {
    res.status(404).json({ success: false, error: 'Model not found' });
    return;
  }
  const { enabled } = req.body as { enabled?: boolean };
  if (enabled !== undefined) model.enabled = enabled;
  res.json({ success: true, data: model });
});

// ══════════════════════════════════════════════════════════════
// Coupons (local coupon service)
// ══════════════════════════════════════════════════════════════

router.get('/coupons', (_req: Request, res: Response) => {
  res.json({ success: true, data: listCoupons() });
});

router.post('/coupons', (req: Request, res: Response): void => {
  requireSuperAdmin(asAdmin(req), res, () => {
    const {
      code,
      type,
      value,
      applicablePlans,
      maxUses,
      expiresAt,
      description,
    } = req.body as {
      code?: string;
      type?: string;
      value?: number;
      applicablePlans?: string[];
      maxUses?: number;
      expiresAt?: number;
      description?: string;
    };

    if (!code || !type || value === undefined) {
      res.status(400).json({ success: false, error: 'code, type, and value are required' });
      return;
    }

    if (getCoupon(code)) {
      res.status(409).json({ success: false, error: 'Coupon code already exists' });
      return;
    }

    const coupon = {
      id: `cpn_admin_${Date.now()}`,
      code: code.toUpperCase(),
      type,
      value,
      applicablePlans: applicablePlans ?? [],
      maxUses: maxUses ?? -1,
      usedCount: 0,
      expiresAt: expiresAt ?? -1,
      active: true,
      createdAt: Date.now(),
      description: description ?? '',
    };
    res.status(201).json({ success: true, data: coupon });
  });
});

router.delete('/coupons/:code', (req: Request, res: Response) => {
  const coupon = getCoupon(req.params['code'] ?? '');
  if (!coupon) {
    res.status(404).json({ success: false, error: 'Coupon not found' });
    return;
  }
  coupon.active = false;
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════
// Platform Settings
// ══════════════════════════════════════════════════════════════

const platformSettings: Record<string, unknown> = {
  maintenanceMode: false,
  signupsEnabled: true,
  marketplaceEnabled: true,
  aiEnabled: true,
  maxProjectsPerFreeUser: 3,
  maxProjectsPerProUser: 50,
  aiDailyQuotaFree: 20,
  aiDailyQuotaPro: 200,
  aiDailyQuotaStudio: 9999,
  featuredCreatorIds: ['cr-001', 'cr-002'],
  platformFeePct: 30,
  refundWindowDays: 14,
  supportEmail: 'support@neurotek.ai',
};

router.get('/settings', (_req: Request, res: Response) => {
  res.json({ success: true, data: platformSettings });
});

router.patch('/settings', (req: Request, res: Response): void => {
  requireSuperAdmin(asAdmin(req), res, () => {
    const updates = req.body as Record<string, unknown>;
    Object.assign(platformSettings, updates);
    res.json({ success: true, data: platformSettings });
  });
});

// ══════════════════════════════════════════════════════════════
// Admin Roles
// ══════════════════════════════════════════════════════════════

const adminRoles: { id: string; email: string; role: string; addedAt: number; addedBy: string }[] = [
  { id: 'role-001', email: 'admin@neurotek.ai', role: 'super_admin', addedAt: Date.now() - 90 * 86_400_000, addedBy: 'system' },
  { id: 'role-002', email: 'moderation@neurotek.ai', role: 'moderator', addedAt: Date.now() - 30 * 86_400_000, addedBy: 'admin@neurotek.ai' },
  { id: 'role-003', email: 'billing@neurotek.ai', role: 'admin', addedAt: Date.now() - 20 * 86_400_000, addedBy: 'admin@neurotek.ai' },
];

router.get('/roles', (_req: Request, res: Response) => {
  res.json({ success: true, data: adminRoles });
});

router.post('/roles', (req: Request, res: Response) => {
  const { email, role } = req.body as { email?: string; role?: string };
  if (!email || !role) {
    res.status(400).json({ success: false, error: 'email and role are required' });
    return;
  }
  const entry = {
    id: `role-${Date.now()}`,
    email,
    role,
    addedAt: Date.now(),
    addedBy: asAdmin(req).adminEmail,
  };
  adminRoles.push(entry);
  res.status(201).json({ success: true, data: entry });
});

router.delete('/roles/:id', (req: Request, res: Response): void => {
  requireSuperAdmin(asAdmin(req), res, () => {
    const idx = adminRoles.findIndex((r) => r.id === req.params['id']);
    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Role entry not found' });
      return;
    }
    adminRoles.splice(idx, 1);
    res.json({ success: true });
  });
});

// ── Plan Management ──────────────────────────────────────────────────────────

// GET /api/admin/plans — list all plans (including inactive)
router.get('/plans', asyncHandler(async (_req, res) => {
  const plans = getPlans(true)  // include inactive
  res.json({ success: true, data: plans, count: plans.length })
}))

// GET /api/admin/plans/:id — get single plan
router.get('/plans/:id', asyncHandler(async (req, res) => {
  const plan = getPlan(req.params['id'] ?? '')
  if (!plan) return res.status(404).json({ error: 'Plan not found' })
  res.json({ success: true, data: plan })
}))

// PATCH /api/admin/plans/:id — update plan
router.patch('/plans/:id', asyncHandler(async (req, res) => {
  const id = req.params['id'] ?? ''
  const allowed = [
    'name', 'priceMonthly', 'priceYearly', 'dailyAIRequests',
    'maxProjects', 'maxPackUploads', 'cloudSyncGB', 'features',
    'model', 'coachAccess', 'analyticsAccess', 'marketplaceAccess',
    'collaborationAccess', 'desktopAccess', 'learningMode',
    'active', 'trialDays', 'sortOrder',
  ]
  const body = req.body as Record<string, unknown>

  // Only allow permitted fields
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // Validate numeric fields
  const numFields = ['priceMonthly', 'priceYearly', 'dailyAIRequests', 'maxProjects', 'maxPackUploads', 'cloudSyncGB', 'trialDays', 'sortOrder']
  for (const f of numFields) {
    if (f in updates && typeof updates[f] !== 'number') {
      return res.status(400).json({ error: `${f} must be a number` })
    }
  }

  // Validate features is array of strings
  if ('features' in updates) {
    if (!Array.isArray(updates['features']) || !(updates['features'] as unknown[]).every(x => typeof x === 'string')) {
      return res.status(400).json({ error: 'features must be an array of strings' })
    }
  }

  const updated = await updatePlan(id, updates as Parameters<typeof updatePlan>[1])
  if (!updated) return res.status(404).json({ error: 'Plan not found' })

  logger.info(`[admin] plan ${id} updated by ${asAdmin(req).adminEmail}`)
  res.json({ success: true, data: updated })
}))

// POST /api/admin/plans — create new plan
router.post('/plans', asyncHandler(async (req, res) => {
  const body = req.body as Record<string, unknown>
  if (!body['id'] || typeof body['id'] !== 'string') {
    return res.status(400).json({ error: 'id is required' })
  }
  if (getPlan(body['id'] as string)) {
    return res.status(409).json({ error: 'Plan already exists' })
  }

  // Build plan with defaults
  const newPlan = {
    id:                   body['id'] as import('../data/plans').Plan,
    name:                 (body['name'] as string) ?? body['id'] as string,
    priceMonthly:         (body['priceMonthly'] as number) ?? 0,
    priceYearly:          (body['priceYearly'] as number) ?? 0,
    dailyAIRequests:      (body['dailyAIRequests'] as number) ?? 20,
    maxProjects:          (body['maxProjects'] as number) ?? 5,
    maxPackUploads:       (body['maxPackUploads'] as number) ?? 0,
    cloudSyncGB:          (body['cloudSyncGB'] as number) ?? 1,
    features:             (body['features'] as string[]) ?? [],
    model:                (body['model'] as 'haiku' | 'sonnet' | 'opus') ?? 'haiku',
    coachAccess:          Boolean(body['coachAccess']),
    analyticsAccess:      Boolean(body['analyticsAccess']),
    marketplaceAccess:    Boolean(body['marketplaceAccess']),
    collaborationAccess:  Boolean(body['collaborationAccess']),
    desktopAccess:        Boolean(body['desktopAccess'] ?? true),
    learningMode:         Boolean(body['learningMode']),
    active:               Boolean(body['active'] ?? true),
    trialDays:            (body['trialDays'] as number) ?? 0,
  }

  const created = await createPlan(newPlan)
  res.status(201).json({ success: true, data: created })
}))

// PATCH /api/admin/plans/:id/toggle — activate or deactivate
router.patch('/plans/:id/toggle', asyncHandler(async (req, res) => {
  const { active } = req.body as { active: boolean }
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'active (boolean) required' })
  const updated = await togglePlan(req.params['id'] ?? '', active)
  if (!updated) return res.status(404).json({ error: 'Plan not found' })
  res.json({ success: true, data: updated })
}))

// GET /api/admin/credit-packs
router.get('/credit-packs', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: getCreditPacks(true) })
}))

// PATCH /api/admin/credit-packs/:id
router.patch('/credit-packs/:id', asyncHandler(async (req, res) => {
  const id = req.params['id'] ?? ''
  const body = req.body as Record<string, unknown>
  const updates: Partial<Omit<import('../lib/creditPackManager').CreditPack, 'id'>> = {}
  if (typeof body['credits'] === 'number')      updates.credits = body['credits']
  if (typeof body['amountCents'] === 'number')  updates.amountCents = body['amountCents']
  if (typeof body['active'] === 'boolean')      updates.active = body['active']
  if (typeof body['sortOrder'] === 'number')    updates.sortOrder = body['sortOrder']
  const updated = await updateCreditPack(id, updates)
  if (!updated) return res.status(404).json({ error: 'Credit pack not found' })
  res.json({ success: true, data: updated })
}))

// PATCH /api/admin/credit-packs/:id/toggle
router.patch('/credit-packs/:id/toggle', asyncHandler(async (req, res) => {
  const { active } = req.body as { active: boolean }
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'active (boolean) required' })
  const updated = await toggleCreditPack(req.params['id'] ?? '', active)
  if (!updated) return res.status(404).json({ error: 'Credit pack not found' })
  res.json({ success: true, data: updated })
}))

export default router;
