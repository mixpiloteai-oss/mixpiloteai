// ============================================================
// NEUROTEK AI — In-Memory Mock Database
// ============================================================
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export type Plan = 'free' | 'pro' | 'studio';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  plan: Plan;
  createdAt: string;
  refreshToken?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: Plan;
  status: 'active' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt?: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  genre: string;
  bpm: number;
  key: string;
  mood: string;
  tracks: unknown[];
  duration: number;
  isStarred: boolean;
  coverColor: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  mood: string;
  description: string;
  tracks: unknown[];
  aiConfidence: number;
  generatedAt: string;
}

// ── Seed users ──────────────────────────────────────────────────

const DEMO_PASSWORD_HASH = bcrypt.hashSync('demo1234', 10);

export const users: User[] = [
  { id: 'user-free', email: 'free@neurotek.ai', name: 'Free Producer', passwordHash: DEMO_PASSWORD_HASH, plan: 'free', createdAt: new Date().toISOString() },
  { id: 'user-pro', email: 'pro@neurotek.ai', name: 'Pro Producer', passwordHash: DEMO_PASSWORD_HASH, plan: 'pro', createdAt: new Date().toISOString() },
  { id: 'user-studio', email: 'studio@neurotek.ai', name: 'Studio Producer', passwordHash: DEMO_PASSWORD_HASH, plan: 'studio', createdAt: new Date().toISOString() },
];

export const subscriptions: Subscription[] = [
  { id: 'sub-free', userId: 'user-free', plan: 'free', status: 'active', createdAt: new Date().toISOString() },
  { id: 'sub-pro', userId: 'user-pro', plan: 'pro', status: 'active', createdAt: new Date().toISOString() },
  { id: 'sub-studio', userId: 'user-studio', plan: 'studio', status: 'active', createdAt: new Date().toISOString() },
];

const projects: Project[] = [];
const templates: Template[] = [];

// Usage tracking: { userId -> { date -> count } }
const usageLog: Record<string, Record<string, number>> = {};

// ── Helpers ───────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function findUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email === email);
}

export function findUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function createUser(data: { email: string; name: string; password: string; plan?: Plan }): User {
  const existing = findUserByEmail(data.email);
  if (existing) throw new Error('Email already in use');

  const user: User = {
    id: uuidv4(),
    email: data.email,
    name: data.name,
    passwordHash: bcrypt.hashSync(data.password, 10),
    plan: data.plan ?? 'free',
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  subscriptions.push({
    id: uuidv4(),
    userId: user.id,
    plan: user.plan,
    status: 'active',
    createdAt: new Date().toISOString(),
  });
  return user;
}

export function getTodayUsage(userId: string): number {
  return usageLog[userId]?.[todayKey()] ?? 0;
}

export function incrementUsage(userId: string): void {
  const today = todayKey();
  if (!usageLog[userId]) usageLog[userId] = {};
  usageLog[userId][today] = (usageLog[userId][today] ?? 0) + 1;
}

export function getDailyLimit(plan: Plan): number {
  const limits: Record<Plan, number> = {
    free: Number(process.env.QUOTA_FREE_DAILY ?? 20),
    pro: Number(process.env.QUOTA_PRO_DAILY ?? 200),
    studio: Number(process.env.QUOTA_STUDIO_DAILY ?? 9999),
  };
  return limits[plan];
}

// ── Project CRUD ─────────────────────────────────────────────────

export const db = {
  getAllProjects: () => projects,
  getProject: (id: string) => projects.find((p) => p.id === id),
  createProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project => {
    const project: Project = { ...data, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    projects.push(project);
    return project;
  },
  updateProject: (id: string, updates: Partial<Project>): Project | null => {
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    projects[idx] = { ...projects[idx], ...updates, updatedAt: new Date().toISOString() };
    return projects[idx];
  },
  deleteProject: (id: string): boolean => {
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    projects.splice(idx, 1);
    return true;
  },
  getAllTemplates: () => templates,
  getTemplate: (id: string) => templates.find((t) => t.id === id),
  saveTemplate: (data: Omit<Template, 'id'>): Template => {
    const template: Template = { ...data, id: uuidv4() };
    templates.push(template);
    return template;
  },
};
