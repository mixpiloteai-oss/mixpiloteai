// ============================================================
// NEUROTEK AI — Admin Routes
// ============================================================
import { Router, Request, Response } from 'express';
import { requireAdmin, requireSuperAdmin, AdminRequest } from '../middleware/adminAuth';
import {
  getPlatformStats,
  getUsers,
  getUser,
  banUser,
  unbanUser,
  getBans,
  deleteUser,
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

const router = Router();

// ── Cast helper ───────────────────────────────────────────────
function asAdmin(req: Request): AdminRequest {
  return req as AdminRequest;
}

// ── All routes require at minimum admin role ──────────────────
router.use((req: Request, res: Response, next) => {
  requireAdmin(asAdmin(req), res, next);
});

// ══════════════════════════════════════════════════════════════
// Overview / Stats
// ══════════════════════════════════════════════════════════════

router.get('/stats', (_req: Request, res: Response) => {
  res.json({ success: true, data: getPlatformStats() });
});

// ══════════════════════════════════════════════════════════════
// Monitoring
// ══════════════════════════════════════════════════════════════

router.get('/monitoring', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      latest: getLatestMetric(),
      metrics: getMetrics(30),
      services: getServiceStatuses(),
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
// Users
// ══════════════════════════════════════════════════════════════

router.get('/users', (req: Request, res: Response) => {
  const { search, plan, sort, page, limit } = req.query;
  const banned = req.query['banned'] !== undefined
    ? req.query['banned'] === 'true'
    : undefined;

  const result = getUsers({
    search: typeof search === 'string' ? search : undefined,
    plan: typeof plan === 'string' ? plan : undefined,
    banned,
    sort: typeof sort === 'string' ? sort : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ success: true, ...result });
});

router.get('/users/:id', (req: Request, res: Response) => {
  const user = getUser(req.params['id'] ?? '');
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  res.json({ success: true, data: user });
});

router.delete('/users/:id', (req: Request, res: Response) => {
  requireSuperAdmin(asAdmin(req), res, () => {
    const ok = deleteUser(req.params['id'] ?? '', asAdmin(req).adminId);
    if (!ok) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true });
  });
});

router.post('/users/:id/ban', (req: Request, res: Response) => {
  const { reason, expiresAt } = req.body as { reason?: string; expiresAt?: number };
  if (!reason) {
    res.status(400).json({ success: false, error: 'reason is required' });
    return;
  }
  const record = banUser(
    req.params['id'] ?? '',
    reason,
    asAdmin(req).adminId,
    expiresAt
  );
  res.json({ success: true, data: record });
});

router.post('/users/:id/unban', (req: Request, res: Response) => {
  const ok = unbanUser(req.params['id'] ?? '');
  if (!ok) {
    res.status(404).json({ success: false, error: 'No active ban found for user' });
    return;
  }
  res.json({ success: true });
});

router.get('/bans', (req: Request, res: Response) => {
  const activeParam = req.query['active'];
  const active = activeParam !== undefined ? activeParam === 'true' : undefined;
  res.json({ success: true, data: getBans(active) });
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

router.post('/marketplace/:id/approve', (req: Request, res: Response) => {
  const ok = approveProduct(req.params['id'] ?? '', asAdmin(req).adminId);
  if (!ok) {
    res.status(404).json({ success: false, error: 'Product not found' });
    return;
  }
  res.json({ success: true });
});

router.post('/marketplace/:id/reject', (req: Request, res: Response) => {
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
  res.json({ success: true });
});

router.delete('/marketplace/:id', (req: Request, res: Response) => {
  requireSuperAdmin(asAdmin(req), res, () => {
    const ok = deleteProduct(req.params['id'] ?? '', asAdmin(req).adminId);
    if (!ok) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
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

router.post('/tickets/:id/reply', (req: Request, res: Response) => {
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
// Payments
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
  // Mock refund — in production this would call Stripe/PayPal
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
// Coupons
// ══════════════════════════════════════════════════════════════

router.get('/coupons', (_req: Request, res: Response) => {
  res.json({ success: true, data: listCoupons() });
});

router.post('/coupons', (req: Request, res: Response) => {
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

    // Return mock created coupon (full persistence handled by couponService in production)
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
// Platform Settings (mock)
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

router.patch('/settings', (req: Request, res: Response) => {
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

router.delete('/roles/:id', (req: Request, res: Response) => {
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

export default router;
