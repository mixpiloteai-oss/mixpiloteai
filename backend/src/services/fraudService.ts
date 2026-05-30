// ============================================================
// NEUROTEK AI — Rule-Based Anti-Fraud Engine
// ============================================================
import { getRecentFailures } from './paymentLogService';

export interface FraudCheckInput {
  userId: string;
  email: string;
  amountCents: number;
  ipAddress: string;
  countryCode: string;
  cardLastFour?: string;
  cardBrand?: string;
  productType: 'subscription' | 'marketplace' | 'credits' | 'plugin';
}

export type FraudDecision = 'allow' | 'review' | 'block';

export interface FraudResult {
  decision: FraudDecision;
  riskScore: number;   // 0–100
  reasons: string[];   // human-readable flags
  requiresCaptcha: boolean;
}

// ── High-Risk Countries ───────────────────────────────────────
const BLOCKED_COUNTRIES = new Set(['KP', 'IR', 'CU', 'SY', 'MM', 'BY']);

// ── Throwaway Email Domains ───────────────────────────────────
const DISPOSABLE_DOMAINS = [
  'mailinator',
  'guerrillamail',
  'tempmail',
  '10minutemail',
  'yopmail',
];

// ── In-Memory Velocity State ──────────────────────────────────
// IP → list of attempt timestamps
const ipAttempts = new Map<string, number[]>();

// userId+amount key → list of timestamps
const dupeAttempts = new Map<string, number[]>();

// cardLastFour → set of userIds with timestamps
const cardUserMap = new Map<string, Array<{ userId: string; ts: number }>>();

// userId → list of failed attempt timestamps (24h window)
const userFailures = new Map<string, number[]>();

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// ── Stale Entry Cleanup (every 5 minutes) ─────────────────────
function clearStaleEntries(): void {
  const now = Date.now();

  for (const [key, timestamps] of ipAttempts) {
    const fresh = timestamps.filter((t) => now - t < MINUTE_MS);
    if (fresh.length === 0) ipAttempts.delete(key);
    else ipAttempts.set(key, fresh);
  }

  for (const [key, timestamps] of dupeAttempts) {
    const fresh = timestamps.filter((t) => now - t < MINUTE_MS);
    if (fresh.length === 0) dupeAttempts.delete(key);
    else dupeAttempts.set(key, fresh);
  }

  for (const [key, entries] of cardUserMap) {
    const fresh = entries.filter((e) => now - e.ts < HOUR_MS);
    if (fresh.length === 0) cardUserMap.delete(key);
    else cardUserMap.set(key, fresh);
  }

  for (const [key, timestamps] of userFailures) {
    const fresh = timestamps.filter((t) => now - t < DAY_MS);
    if (fresh.length === 0) userFailures.delete(key);
    else userFailures.set(key, fresh);
  }
}

const _t = setInterval(clearStaleEntries, 5 * MINUTE_MS); if (typeof _t.unref === "function") _t.unref();

// ── Record a failure for the user ────────────────────────────
export function recordPaymentFailure(userId: string): void {
  const now = Date.now();
  const existing = userFailures.get(userId) ?? [];
  existing.push(now);
  userFailures.set(userId, existing);
}

// ── Individual Rule Evaluators ────────────────────────────────

function checkAmountVelocity(amountCents: number): { score: number; reason: string | null } {
  if (amountCents > 50_000) return { score: 30, reason: 'Large transaction (>$500)' };
  if (amountCents > 20_000) return { score: 15, reason: 'Elevated transaction amount (>$200)' };
  return { score: 0, reason: null };
}

function checkIPVelocity(ipAddress: string): { score: number; reason: string | null } {
  const now = Date.now();
  const attempts = ipAttempts.get(ipAddress) ?? [];
  const recent = attempts.filter((t) => now - t < MINUTE_MS);
  recent.push(now);
  ipAttempts.set(ipAddress, recent);

  if (recent.length > 5) {
    return { score: 40, reason: `Too many attempts from IP ${ipAddress} (${recent.length} in 60s)` };
  }
  return { score: 0, reason: null };
}

function checkHighRiskCountry(countryCode: string): { score: number; reason: string | null } {
  if (BLOCKED_COUNTRIES.has(countryCode.toUpperCase())) {
    return { score: 100, reason: `Blocked country: ${countryCode}` };
  }
  return { score: 0, reason: null };
}

function checkDuplicateAttempt(userId: string, amountCents: number): { score: number; reason: string | null } {
  const key = `${userId}:${amountCents}`;
  const now = Date.now();
  const attempts = dupeAttempts.get(key) ?? [];
  const recent = attempts.filter((t) => now - t < MINUTE_MS);
  recent.push(now);
  dupeAttempts.set(key, recent);

  if (recent.length > 1) {
    return { score: 35, reason: 'Duplicate payment attempt (same user + amount within 60s)' };
  }
  return { score: 0, reason: null };
}

function checkSuspiciousEmail(email: string): { score: number; reason: string | null } {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  for (const d of DISPOSABLE_DOMAINS) {
    if (domain.includes(d)) {
      return { score: 20, reason: `Disposable email domain detected: ${domain}` };
    }
  }
  return { score: 0, reason: null };
}

function checkFreeTierAbuse(userId: string): { score: number; reason: string | null } {
  // Check in-memory failures
  const inMemory = userFailures.get(userId) ?? [];
  const now = Date.now();
  const recent = inMemory.filter((t) => now - t < DAY_MS);

  // Also check log service for additional coverage
  let logFailures = 0;
  try {
    logFailures = getRecentFailures(userId, DAY_MS).length;
  } catch {
    // log service may not have data
  }

  const total = recent.length + logFailures;
  if (total > 3) {
    return { score: 15, reason: `Multiple failed payment attempts in 24h (${total} failures)` };
  }
  return { score: 0, reason: null };
}

function checkCardVelocity(
  cardLastFour: string | undefined,
  userId: string
): { score: number; reason: string | null } {
  if (!cardLastFour) return { score: 0, reason: null };

  const now = Date.now();
  const entries = cardUserMap.get(cardLastFour) ?? [];
  const recent = entries.filter((e) => now - e.ts < HOUR_MS);

  // Add current attempt
  recent.push({ userId, ts: now });
  cardUserMap.set(cardLastFour, recent);

  // Count distinct user IDs
  const distinctUsers = new Set(recent.map((e) => e.userId));
  if (distinctUsers.size > 3) {
    return {
      score: 25,
      reason: `Card ending ${cardLastFour} used across ${distinctUsers.size} accounts in 1h`,
    };
  }
  return { score: 0, reason: null };
}

// ── Main Export ───────────────────────────────────────────────

export function checkFraud(input: FraudCheckInput): FraudResult {
  const reasons: string[] = [];
  let riskScore = 0;

  // Rule 3: high-risk country first (may set to 100)
  const country = checkHighRiskCountry(input.countryCode);
  if (country.score > 0 && country.reason) {
    riskScore = country.score;
    reasons.push(country.reason);
    return {
      decision: 'block',
      riskScore: Math.min(100, riskScore),
      reasons,
      requiresCaptcha: true,
    };
  }

  // Rule 1: amount velocity
  const amount = checkAmountVelocity(input.amountCents);
  if (amount.score > 0 && amount.reason) {
    riskScore += amount.score;
    reasons.push(amount.reason);
  }

  // Rule 2: IP velocity
  const ip = checkIPVelocity(input.ipAddress);
  if (ip.score > 0 && ip.reason) {
    riskScore += ip.score;
    reasons.push(ip.reason);
  }

  // Rule 4: duplicate detection
  const dupe = checkDuplicateAttempt(input.userId, input.amountCents);
  if (dupe.score > 0 && dupe.reason) {
    riskScore += dupe.score;
    reasons.push(dupe.reason);
  }

  // Rule 5: suspicious email
  const email = checkSuspiciousEmail(input.email);
  if (email.score > 0 && email.reason) {
    riskScore += email.score;
    reasons.push(email.reason);
  }

  // Rule 6: free-tier abuse
  const abuse = checkFreeTierAbuse(input.userId);
  if (abuse.score > 0 && abuse.reason) {
    riskScore += abuse.score;
    reasons.push(abuse.reason);
  }

  // Rule 7: card velocity
  const card = checkCardVelocity(input.cardLastFour, input.userId);
  if (card.score > 0 && card.reason) {
    riskScore += card.score;
    reasons.push(card.reason);
  }

  riskScore = Math.min(100, riskScore);

  let decision: FraudDecision;
  if (riskScore >= 60) {
    decision = 'block';
  } else if (riskScore >= 30) {
    decision = 'review';
  } else {
    decision = 'allow';
  }

  return {
    decision,
    riskScore,
    reasons,
    requiresCaptcha: riskScore >= 30,
  };
}
