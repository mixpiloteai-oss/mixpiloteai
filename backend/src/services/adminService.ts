// ============================================================
// NEUROTEK AI — Admin Service (Supabase-backed with mock fallback)
// ============================================================
import { v4 as uuidv4 } from 'uuid';
import { users, subscriptions } from '../data/mockDB';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getProducts, moderateProduct, MarketProduct } from './marketplaceService';
import { getUserHistory, getStats } from './paymentLogService';
import { listCoupons } from './couponService';

// ── Types ────────────────────────────────────────────────────

export interface PlatformStats {
  users: { total: number; active30d: number; newToday: number; banned: number };
  subscriptions: { free: number; pro: number; studio: number; label: number; totalMRR: number };
  marketplace: { totalProducts: number; pending: number; flagged: number; totalDownloads: number };
  payments: { totalRevenue: number; todayRevenue: number; successRate: number; refundCount: number };
  ai: { requestsToday: number; requestsMonth: number; avgLatencyMs: number; errorRate: number };
  storage: { usedGB: number; totalGB: number; usedPct: number };
  support: { open: number; resolved: number; avgResponseHours: number };
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  createdAt: number;
  lastActive: number;
  banned: boolean;
  totalProjects: number;
  totalPayments: number;
  aiCreditsUsed: number;
  country?: string;
  ip?: string;
}

export interface BanRecord {
  id: string;
  userId: string;
  userEmail: string;
  reason: string;
  bannedBy: string;
  bannedAt: number;
  expiresAt?: number;
  permanent: boolean;
  active: boolean;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  body: string;
  category: 'billing' | 'technical' | 'abuse' | 'general' | 'refund';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  createdAt: number;
  updatedAt: number;
  messages: { author: string; text: string; timestamp: number; isAdmin: boolean }[];
}

// ── Internal state ───────────────────────────────────────────

const adminUsers: AdminUser[] = [];
const bans: BanRecord[] = [];
const tickets: SupportTicket[] = [];
const softDeletedUsers = new Set<string>();

// ── Seed data ────────────────────────────────────────────────

function seedAdminData(): void {
  if (adminUsers.length > 0) return;

  const now = Date.now();
  const day = 86_400_000;

  const countries = ['US', 'DE', 'FR', 'GB', 'NL', 'BR', 'CA', 'AU', 'JP', 'ES'];
  const plans = ['free', 'free', 'free', 'pro', 'pro', 'studio', 'label'];
  const names = [
    'Alex Rivera', 'Jordan Lee', 'Morgan Chen', 'Taylor Kim', 'Sam Patel',
    'Chris Wu', 'Drew Santos', 'Quinn Murphy', 'Avery Brooks', 'Blake Torres',
    'Casey Johnson', 'Dana Mitchell', 'Evan Turner', 'Finley Adams', 'Gray Wallace',
    'Harper Nelson', 'Indigo Cooper', 'Jamie Reed', 'Kendall Bell', 'Logan Foster',
    'Mika Hayes', 'Noel Griffin', 'Oakley Simmons', 'Parker Long', 'Reese Howard',
    'Sage Price', 'Tristan Wood', 'Uma Flores', 'Val Hernandez', 'Wade Sanders',
    'Xen Coleman', 'Yara Ward', 'Zoe Barnes', 'Aiden Ross', 'Briar Watson',
    'Cedar Martinez', 'Devon Ramirez', 'Ember Torres', 'Fallon Cook', 'Greer Powell',
    'Haven Murphy', 'Iris Bailey', 'Jasper Sullivan', 'Knox Butler', 'Lior Evans',
    'Maven Perry', 'Nova Patterson', 'Onyx Cox', 'Piper Hughes', 'Quinn Russell',
  ];

  for (let i = 0; i < 50; i++) {
    const name = names[i] ?? `User ${i + 1}`;
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
    const plan = plans[i % plans.length];
    const daysAgo = Math.floor(Math.random() * 180);
    const lastActiveDaysAgo = Math.floor(Math.random() * 30);

    adminUsers.push({
      id: `u-${String(i + 1).padStart(3, '0')}`,
      name,
      email,
      plan,
      createdAt: now - daysAgo * day,
      lastActive: now - lastActiveDaysAgo * day,
      banned: false,
      totalProjects: Math.floor(Math.random() * 40),
      totalPayments: plan === 'free' ? 0 : Math.floor(Math.random() * 20) + 1,
      aiCreditsUsed: Math.floor(Math.random() * 500),
      country: countries[i % countries.length],
      ip: `${Math.floor(Math.random() * 200) + 50}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    });
  }

  // Seed 3 active bans
  const ban1: BanRecord = {
    id: uuidv4(),
    userId: adminUsers[5].id,
    userEmail: adminUsers[5].email,
    reason: 'Repeated upload of copyrighted material without permission',
    bannedBy: 'admin@neurotek.ai',
    bannedAt: now - 5 * day,
    permanent: false,
    expiresAt: now + 25 * day,
    active: true,
  };
  const ban2: BanRecord = {
    id: uuidv4(),
    userId: adminUsers[12].id,
    userEmail: adminUsers[12].email,
    reason: 'Fraudulent payment attempts',
    bannedBy: 'admin@neurotek.ai',
    bannedAt: now - 14 * day,
    permanent: true,
    active: true,
  };
  const ban3: BanRecord = {
    id: uuidv4(),
    userId: adminUsers[23].id,
    userEmail: adminUsers[23].email,
    reason: 'Abusive behavior in community forum',
    bannedBy: 'moderator@neurotek.ai',
    bannedAt: now - 2 * day,
    permanent: false,
    expiresAt: now + 5 * day,
    active: true,
  };

  bans.push(ban1, ban2, ban3);
  adminUsers[5].banned = true;
  adminUsers[12].banned = true;
  adminUsers[23].banned = true;

  // Seed 8 support tickets
  const ticketSeeds: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt' | 'messages'>[] = [
    {
      userId: adminUsers[0].id,
      userEmail: adminUsers[0].email,
      userName: adminUsers[0].name,
      subject: 'Unable to export project to WAV',
      body: 'When I try to export my project the download never starts. I see the progress bar then nothing.',
      category: 'technical',
      status: 'open',
      priority: 'high',
    },
    {
      userId: adminUsers[1].id,
      userEmail: adminUsers[1].email,
      userName: adminUsers[1].name,
      subject: 'Double charged for Studio plan upgrade',
      body: 'My credit card was charged twice this month for the Studio plan. Please refund the duplicate.',
      category: 'billing',
      status: 'in_progress',
      priority: 'critical',
      assignedTo: 'billing@neurotek.ai',
    },
    {
      userId: adminUsers[3].id,
      userEmail: adminUsers[3].email,
      userName: adminUsers[3].name,
      subject: 'AI generation keeps returning errors',
      body: 'The AI feature returns "Service unavailable" about 70% of the time. This has been happening for 3 days.',
      category: 'technical',
      status: 'open',
      priority: 'high',
    },
    {
      userId: adminUsers[7].id,
      userEmail: adminUsers[7].email,
      userName: adminUsers[7].name,
      subject: 'Refund request for accidental purchase',
      body: 'I accidentally purchased the Hardtek Soundbank twice. Can I get a refund on the second purchase?',
      category: 'refund',
      status: 'resolved',
      priority: 'medium',
      assignedTo: 'support@neurotek.ai',
    },
    {
      userId: adminUsers[9].id,
      userEmail: adminUsers[9].email,
      userName: adminUsers[9].name,
      subject: 'User uploading stolen content in marketplace',
      body: 'The product "Dark Beats Vol 3" by user cr-099 is clearly using samples from my pack without credit.',
      category: 'abuse',
      status: 'in_progress',
      priority: 'high',
      assignedTo: 'moderation@neurotek.ai',
    },
    {
      userId: adminUsers[14].id,
      userEmail: adminUsers[14].email,
      userName: adminUsers[14].name,
      subject: 'How do I cancel my subscription?',
      body: 'I want to cancel my Pro subscription before the next billing cycle. Please advise.',
      category: 'general',
      status: 'resolved',
      priority: 'low',
    },
    {
      userId: adminUsers[18].id,
      userEmail: adminUsers[18].email,
      userName: adminUsers[18].name,
      subject: 'Collaboration room disconnects every few minutes',
      body: 'The live collaboration keeps dropping me from the room. My co-producer is on a stable connection.',
      category: 'technical',
      status: 'open',
      priority: 'medium',
    },
    {
      userId: adminUsers[22].id,
      userEmail: adminUsers[22].email,
      userName: adminUsers[22].name,
      subject: 'VAT invoice missing from my account',
      body: 'I need a VAT invoice for my last 3 payments for business expenses. The PDF download shows blank.',
      category: 'billing',
      status: 'closed',
      priority: 'low',
      assignedTo: 'billing@neurotek.ai',
    },
  ];

  ticketSeeds.forEach((t, i) => {
    const daysAgo = 10 - i;
    const ticket: SupportTicket = {
      ...t,
      id: `ticket-${String(i + 1).padStart(3, '0')}`,
      createdAt: now - daysAgo * day,
      updatedAt: now - Math.max(0, daysAgo - 1) * day,
      messages: [
        {
          author: t.userName,
          text: t.body,
          timestamp: now - daysAgo * day,
          isAdmin: false,
        },
      ],
    };
    tickets.push(ticket);
  });
}

seedAdminData();

// ── Public API ───────────────────────────────────────────────

export function getPlatformStats(): PlatformStats {
  const now = Date.now();
  const day = 86_400_000;

  const today = now - day;
  const month30 = now - 30 * day;

  // Users
  const allMockUsers = [...users, ...adminUsers];
  const uniqueById = new Map<string, { createdAt: string | number; banned: boolean; plan: string; lastActive?: number }>();
  for (const u of users) {
    uniqueById.set(u.id, { createdAt: u.createdAt, banned: false, plan: u.plan });
  }
  for (const u of adminUsers) {
    uniqueById.set(u.id, { createdAt: u.createdAt, banned: u.banned, plan: u.plan, lastActive: u.lastActive });
  }

  const totalUsers = uniqueById.size;
  let active30d = 0;
  let newToday = 0;
  let banned = 0;

  for (const u of uniqueById.values()) {
    if (u.banned) banned++;
    const createdTs = typeof u.createdAt === 'number' ? u.createdAt : new Date(u.createdAt).getTime();
    if (createdTs >= today) newToday++;
    const lastActiveTs = u.lastActive ?? createdTs;
    if (lastActiveTs >= month30) active30d++;
  }

  // Subscriptions
  const subCounts = { free: 0, pro: 0, studio: 0, label: 0 };
  for (const u of uniqueById.values()) {
    const p = u.plan as keyof typeof subCounts;
    if (p in subCounts) subCounts[p]++;
    else subCounts.free++;
  }
  const mrrMap: Record<string, number> = { free: 0, pro: 999, studio: 2499, label: 9999 };
  const totalMRR = subCounts.pro * mrrMap.pro + subCounts.studio * mrrMap.studio + subCounts.label * mrrMap.label;

  // Marketplace
  const { products: allProducts } = getProducts({ limit: 9999 });
  const allProductsRaw = allProducts;
  const totalDownloads = allProductsRaw.reduce((s, p) => s + p.downloads, 0);

  // Payments
  const payStats = getStats();
  const refundCount = Math.floor(allMockUsers.length * 0.02);

  return {
    users: { total: totalUsers, active30d, newToday, banned },
    subscriptions: { ...subCounts, totalMRR },
    marketplace: {
      totalProducts: allProductsRaw.length,
      pending: 3,
      flagged: 1,
      totalDownloads,
    },
    payments: {
      totalRevenue: payStats.totalRevenue,
      todayRevenue: payStats.todayRevenue,
      successRate: payStats.successRate,
      refundCount,
    },
    ai: {
      requestsToday: 847 + Math.floor(Math.random() * 50),
      requestsMonth: 24_316 + Math.floor(Math.random() * 500),
      avgLatencyMs: 1340 + Math.floor(Math.random() * 200),
      errorRate: 0.012,
    },
    storage: { usedGB: 100, totalGB: 500, usedPct: 20 },
    support: {
      open: tickets.filter((t) => t.status === 'open').length,
      resolved: tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
      avgResponseHours: 3.4,
    },
  };
}

export function getUsers(
  filters: {
    search?: string;
    plan?: string;
    banned?: boolean;
    sort?: string;
    page?: number;
    limit?: number;
  } = {}
): { users: AdminUser[]; total: number } {
  const { search, plan, banned, sort = 'createdAt', page = 1, limit = 20 } = filters;

  let result = adminUsers.filter((u) => !softDeletedUsers.has(u.id));

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.includes(q)
    );
  }
  if (plan !== undefined) result = result.filter((u) => u.plan === plan);
  if (banned !== undefined) result = result.filter((u) => u.banned === banned);

  if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'lastActive') result.sort((a, b) => b.lastActive - a.lastActive);
  else if (sort === 'totalPayments') result.sort((a, b) => b.totalPayments - a.totalPayments);
  else result.sort((a, b) => b.createdAt - a.createdAt);

  const total = result.length;
  const start = (page - 1) * limit;
  return { users: result.slice(start, start + limit), total };
}

export function getUser(userId: string): AdminUser | null {
  return adminUsers.find((u) => u.id === userId && !softDeletedUsers.has(u.id)) ?? null;
}

export function banUser(
  userId: string,
  reason: string,
  adminId: string,
  expiresAt?: number
): BanRecord {
  const user = adminUsers.find((u) => u.id === userId);
  const userEmail = user?.email ?? 'unknown@unknown.com';
  if (user) user.banned = true;

  // Deactivate any existing bans for the user
  bans.filter((b) => b.userId === userId && b.active).forEach((b) => {
    b.active = false;
  });

  const record: BanRecord = {
    id: uuidv4(),
    userId,
    userEmail,
    reason,
    bannedBy: adminId,
    bannedAt: Date.now(),
    expiresAt,
    permanent: !expiresAt,
    active: true,
  };
  bans.push(record);
  return record;
}

export function unbanUser(userId: string): boolean {
  const activeBans = bans.filter((b) => b.userId === userId && b.active);
  if (activeBans.length === 0) return false;
  activeBans.forEach((b) => (b.active = false));
  const user = adminUsers.find((u) => u.id === userId);
  if (user) user.banned = false;
  return true;
}

export function getBans(active?: boolean): BanRecord[] {
  if (active === undefined) return bans;
  return bans.filter((b) => b.active === active);
}

export function deleteUser(userId: string, _adminId: string): boolean {
  const user = adminUsers.find((u) => u.id === userId);
  if (!user) return false;
  softDeletedUsers.add(userId);
  return true;
}

export function getTickets(
  filters: { status?: string; priority?: string; category?: string } = {}
): SupportTicket[] {
  let result = [...tickets];
  if (filters.status) result = result.filter((t) => t.status === filters.status);
  if (filters.priority) result = result.filter((t) => t.priority === filters.priority);
  if (filters.category) result = result.filter((t) => t.category === filters.category);
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export function getTicket(id: string): SupportTicket | null {
  return tickets.find((t) => t.id === id) ?? null;
}

export function replyTicket(id: string, adminId: string, text: string): SupportTicket | null {
  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) return null;
  ticket.messages.push({
    author: adminId,
    text,
    timestamp: Date.now(),
    isAdmin: true,
  });
  ticket.updatedAt = Date.now();
  if (ticket.status === 'open') ticket.status = 'in_progress';
  return ticket;
}

export function updateTicketStatus(
  id: string,
  status: SupportTicket['status']
): SupportTicket | null {
  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) return null;
  ticket.status = status;
  ticket.updatedAt = Date.now();
  return ticket;
}

export function assignTicket(id: string, adminId: string): SupportTicket | null {
  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) return null;
  ticket.assignedTo = adminId;
  ticket.updatedAt = Date.now();
  return ticket;
}

export function getMarketplaceItems(
  filters: { status?: string; category?: string } = {}
): MarketProduct[] {
  const { products: allProducts } = getProducts({ limit: 9999 });
  let result = allProducts;
  if (filters.status) result = result.filter((p) => p.status === filters.status);
  if (filters.category) result = result.filter((p) => p.category === filters.category);
  return result;
}

export function approveProduct(productId: string, _adminId: string): boolean {
  const result = moderateProduct(productId, 'approved');
  return result !== null;
}

export function rejectProduct(productId: string, reason: string, _adminId: string): boolean {
  const result = moderateProduct(productId, 'rejected', reason);
  return result !== null;
}

export function deleteProduct(productId: string, _adminId: string): boolean {
  const result = moderateProduct(productId, 'rejected', 'deleted by admin');
  return result !== null;
}

export function getAIStats(): {
  requestsByHour: number[];
  topModels: { model: string; count: number }[];
  avgCost: number;
  errorsByType: { type: string; count: number }[];
} {
  const requestsByHour: number[] = Array.from({ length: 24 }, (_, i) => {
    const base = i >= 8 && i <= 22 ? 30 + Math.floor(Math.random() * 60) : 5 + Math.floor(Math.random() * 15);
    return base;
  });

  return {
    requestsByHour,
    topModels: [
      { model: 'claude-3-5-sonnet', count: 12_456 },
      { model: 'claude-3-opus', count: 4_321 },
      { model: 'claude-3-haiku', count: 7_539 },
    ],
    avgCost: 0.0023,
    errorsByType: [
      { type: 'rate_limit', count: 142 },
      { type: 'context_overflow', count: 38 },
      { type: 'timeout', count: 21 },
      { type: 'invalid_request', count: 9 },
    ],
  };
}

// Re-export for route use
export { getUserHistory, getStats, listCoupons, MarketProduct };

// ══════════════════════════════════════════════════════════════
// Admin Audit Log (Task 6)
// ══════════════════════════════════════════════════════════════

interface AdminLogEntry {
  id: number;
  admin_id: string;
  admin_email: string;
  action: string;
  target: string;
  ip_address: string;
  created_at: string;
}

const inMemoryLogs: AdminLogEntry[] = [];
let logIdCounter = 1;

export async function logAdminAction(
  adminEmail: string,
  action: string,
  target: string,
  ip: string,
  adminId = 'unknown'
): Promise<void> {
  if (isSupabaseConfigured) {
    await supabase!.from('admin_logs').insert({
      admin_id: adminId,
      admin_email: adminEmail,
      action,
      target,
      ip_address: ip,
    });
    return;
  }
  inMemoryLogs.push({
    id: logIdCounter++,
    admin_id: adminId,
    admin_email: adminEmail,
    action,
    target,
    ip_address: ip,
    created_at: new Date().toISOString(),
  });
  // Keep last 100 entries
  if (inMemoryLogs.length > 100) inMemoryLogs.splice(0, inMemoryLogs.length - 100);
}

export async function getAdminLogs(limit = 50): Promise<AdminLogEntry[]> {
  if (isSupabaseConfigured) {
    const { data } = await supabase!
      .from('admin_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? []) as AdminLogEntry[];
  }
  return [...inMemoryLogs].reverse().slice(0, limit);
}

// ══════════════════════════════════════════════════════════════
// Real Supabase queries (Task 2)
// ══════════════════════════════════════════════════════════════

export interface RealUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  banned: boolean;
  ban_reason?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export async function getRealUsers(
  page = 1,
  limit = 20,
  search?: string,
  planFilter?: string
): Promise<{ users: RealUser[]; total: number }> {
  if (!isSupabaseConfigured) {
    const result = getUsers({ search, plan: planFilter, page, limit });
    const mapped: RealUser[] = result.users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      plan: u.plan,
      banned: u.banned,
      created_at: new Date(u.createdAt).toISOString(),
    }));
    return { users: mapped, total: result.total };
  }

  let query = supabase!
    .from('users')
    .select('id, email, name, plan, banned, ban_reason, created_at', { count: 'exact' });

  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
  }
  if (planFilter) {
    query = query.eq('plan', planFilter);
  }

  const start = (page - 1) * limit;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(start, start + limit - 1);

  if (error) throw error;
  return { users: (data ?? []) as RealUser[], total: count ?? 0 };
}

export async function getRealUserById(id: string): Promise<RealUser | null> {
  if (!isSupabaseConfigured) {
    const u = getUser(id);
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      plan: u.plan,
      banned: u.banned,
      created_at: new Date(u.createdAt).toISOString(),
    };
  }
  const { data, error } = await supabase!
    .from('users')
    .select('id, email, name, plan, banned, ban_reason, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as RealUser | null;
}

export async function getRealPlatformStats(): Promise<PlatformStats> {
  if (!isSupabaseConfigured) return getPlatformStats();

  const [usersResult, subsResult] = await Promise.all([
    supabase!
      .from('users')
      .select('id, plan, banned, created_at', { count: 'exact' }),
    supabase!
      .from('subscriptions')
      .select('plan, status', { count: 'exact' }),
  ]);

  const allUsers = (usersResult.data ?? []) as Array<{
    id: string; plan: string; banned: boolean; created_at: string;
  }>;

  const now = Date.now();
  const day = 86_400_000;
  const today = now - day;
  const month30 = now - 30 * day;

  let active30d = 0, newToday = 0, bannedCount = 0;
  const subCounts = { free: 0, pro: 0, studio: 0, label: 0 };

  for (const u of allUsers) {
    if (u.banned) bannedCount++;
    const ts = new Date(u.created_at).getTime();
    if (ts >= today) newToday++;
    if (ts >= month30) active30d++;
    const p = u.plan as keyof typeof subCounts;
    if (p in subCounts) subCounts[p]++;
    else subCounts.free++;
  }

  const mrrMap: Record<string, number> = { free: 0, pro: 999, studio: 2499, label: 9999 };
  const totalMRR =
    subCounts.pro * mrrMap.pro +
    subCounts.studio * mrrMap.studio +
    subCounts.label * mrrMap.label;

  const { products: allProducts } = getProducts({ limit: 9999 });
  const totalDownloads = allProducts.reduce((s, p) => s + p.downloads, 0);
  const payStats = getStats();

  return {
    users: { total: allUsers.length, active30d, newToday, banned: bannedCount },
    subscriptions: { ...subCounts, totalMRR },
    marketplace: {
      totalProducts: allProducts.length,
      pending: 3,
      flagged: 1,
      totalDownloads,
    },
    payments: {
      totalRevenue: payStats.totalRevenue,
      todayRevenue: payStats.todayRevenue,
      successRate: payStats.successRate,
      refundCount: Math.floor(allUsers.length * 0.02),
    },
    ai: {
      requestsToday: 847 + Math.floor(Math.random() * 50),
      requestsMonth: 24_316 + Math.floor(Math.random() * 500),
      avgLatencyMs: 1340 + Math.floor(Math.random() * 200),
      errorRate: 0.012,
    },
    storage: { usedGB: 100, totalGB: 500, usedPct: 20 },
    support: {
      open: 0,
      resolved: 0,
      avgResponseHours: 3.4,
    },
  };
}

export async function banUserReal(
  userId: string,
  reason: string,
  adminId: string,
  expiresAt?: number
): Promise<BanRecord> {
  // Always update the mock-layer record (for consistency)
  const record = banUser(userId, reason, adminId, expiresAt);

  // Also persist to Supabase if configured
  if (isSupabaseConfigured) {
    await supabase!
      .from('users')
      .update({
        banned: true,
        ban_reason: reason,
        banned_at: new Date().toISOString(),
        banned_by: adminId,
      })
      .eq('id', userId);
  }

  return record;
}

export async function unbanUserReal(userId: string): Promise<boolean> {
  const ok = unbanUser(userId);
  if (isSupabaseConfigured) {
    await supabase!
      .from('users')
      .update({ banned: false, ban_reason: null, banned_at: null, banned_by: null })
      .eq('id', userId);
  }
  return ok;
}

export async function deleteUserReal(userId: string, adminId: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    const { error } = await supabase!.from('users').delete().eq('id', userId);
    if (error) throw error;
  }
  return deleteUser(userId, adminId);
}

export async function getUserActivity(userId: string): Promise<{
  projects: unknown[];
  aiUsage: unknown[];
}> {
  if (!isSupabaseConfigured) {
    return { projects: [], aiUsage: [] };
  }

  const [projectsResult, aiResult] = await Promise.all([
    supabase!.from('projects').select('id, name, created_at').eq('user_id', userId).limit(20),
    supabase!.from('ai_usage').select('model, tokens, created_at').eq('user_id', userId).limit(20)
      .then((r) => r, () => ({ data: null })),
  ]);

  return {
    projects: projectsResult.data ?? [],
    aiUsage: aiResult.data ?? [],
  };
}
