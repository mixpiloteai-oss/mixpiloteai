/**
 * UserService — Supabase-backed with in-memory fallback.
 * When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set the service reads/
 * writes to Supabase. Otherwise it falls back to the in-memory mock DB so
 * the app still boots in dev without credentials.
 */
import bcrypt from 'bcryptjs';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  findUserByEmail as mockFindByEmail,
  findUserById as mockFindById,
  createUser as mockCreateUser,
  getTodayUsage as mockGetUsage,
  incrementUsage as mockIncrementUsage,
  getDailyLimit,
  type Plan,
} from '../data/mockDB';

export type { Plan };

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  passwordHash: string;
  refreshToken?: string | null;
  createdAt: string;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function sbFindByEmail(email: string): Promise<UserRecord | null> {
  const { data, error } = await supabase!
    .from('users')
    .select('id, email, name, plan, password_hash, refresh_token, created_at')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    plan: data.plan as Plan,
    passwordHash: data.password_hash,
    refreshToken: data.refresh_token,
    createdAt: data.created_at,
  };
}

async function sbFindById(id: string): Promise<UserRecord | null> {
  const { data, error } = await supabase!
    .from('users')
    .select('id, email, name, plan, password_hash, refresh_token, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    plan: data.plan as Plan,
    passwordHash: data.password_hash,
    refreshToken: data.refresh_token,
    createdAt: data.created_at,
  };
}

async function sbCreateUser(data: { email: string; name: string; password: string; plan?: Plan }): Promise<UserRecord> {
  const existing = await sbFindByEmail(data.email);
  if (existing) throw new Error('Email already in use');
  const passwordHash = bcrypt.hashSync(data.password, 10);
  const { data: row, error } = await supabase!
    .from('users')
    .insert({ email: data.email, name: data.name, password_hash: passwordHash, plan: data.plan ?? 'free' })
    .select('id, email, name, plan, password_hash, refresh_token, created_at')
    .single();
  if (error) throw error;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    plan: row.plan as Plan,
    passwordHash: row.password_hash,
    refreshToken: row.refresh_token,
    createdAt: row.created_at,
  };
}

async function sbSetRefreshToken(userId: string, token: string | null): Promise<void> {
  const { error } = await supabase!
    .from('users')
    .update({ refresh_token: token })
    .eq('id', userId);
  if (error) throw error;
}

async function sbGetTodayUsage(userId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase!
    .from('usage_log')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();
  if (error) throw error;
  return (data?.count as number) ?? 0;
}

async function sbIncrementUsage(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  // upsert: insert or increment
  const { error } = await supabase!.rpc('increment_usage', { p_user_id: userId, p_date: today });
  if (error) {
    // fallback: plain upsert (requires unique constraint on user_id + date)
    const current = await sbGetTodayUsage(userId);
    await supabase!
      .from('usage_log')
      .upsert({ user_id: userId, date: today, count: current + 1 }, { onConflict: 'user_id,date' });
  }
}

// ── Mock adapters (wrap the in-memory DB to match UserRecord shape) ──────────

function mockToRecord(u: ReturnType<typeof mockFindByEmail>): UserRecord | null {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    plan: u.plan as Plan,
    passwordHash: u.passwordHash,
    refreshToken: u.refreshToken,
    createdAt: u.createdAt,
  };
}

// ── Public API (used by routes) ───────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  if (isSupabaseConfigured) return sbFindByEmail(email);
  return mockToRecord(mockFindByEmail(email));
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (isSupabaseConfigured) return sbFindById(id);
  return mockToRecord(mockFindById(id));
}

export async function createUser(data: {
  email: string;
  name: string;
  password: string;
  plan?: Plan;
}): Promise<UserRecord> {
  if (isSupabaseConfigured) return sbCreateUser(data);
  const u = mockCreateUser(data);
  return mockToRecord(u)!;
}

export async function setRefreshToken(userId: string, token: string | null): Promise<void> {
  if (isSupabaseConfigured) {
    await sbSetRefreshToken(userId, token);
    return;
  }
  const u = mockFindById(userId);
  if (u) u.refreshToken = token ?? undefined;
}

export async function getTodayUsage(userId: string): Promise<number> {
  if (isSupabaseConfigured) return sbGetTodayUsage(userId);
  return mockGetUsage(userId);
}

export async function incrementUsage(userId: string): Promise<void> {
  if (isSupabaseConfigured) {
    await sbIncrementUsage(userId);
    return;
  }
  mockIncrementUsage(userId);
}

export { getDailyLimit };
