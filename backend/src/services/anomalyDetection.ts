// ============================================================
// NEUROTEK AI — Anomaly Detection Service
// ============================================================
// Behavioral anomaly detection using statistical analysis of
// per-user and per-IP request patterns.
// ============================================================
import { logSecurityEvent } from '../utils/securityLog';

interface UserBaseline {
  userId: string;
  requestCounts: number[];   // rolling 5-minute buckets (12 buckets = 1h)
  errorRate: number;         // fraction of 4xx/5xx responses
  endpoints: Set<string>;    // distinct endpoints accessed
  lastSeen: number;
  anomalyScore: number;      // 0-100
}

interface IpBaseline {
  ip: string;
  requestCounts: number[];
  distinctUsers: Set<string>;
  distinctEndpoints: Set<string>;
  lastSeen: number;
  anomalyScore: number;
}

const BUCKET_MS = 5 * 60 * 1000;   // 5-minute buckets
const NUM_BUCKETS = 12;              // 1 hour of history
const HIGH_ANOMALY_THRESHOLD = 70;
const CRITICAL_ANOMALY_THRESHOLD = 90;

const userBaselines = new Map<string, UserBaseline>();
const ipBaselines = new Map<string, IpBaseline>();

function currentBucket(): number {
  return Math.floor(Date.now() / BUCKET_MS);
}

function getBucketIndex(bucket: number, baseline: { requestCounts: number[] }): number {
  return bucket % NUM_BUCKETS;
}

function ensureUserBaseline(userId: string): UserBaseline {
  let bl = userBaselines.get(userId);
  if (!bl) {
    bl = {
      userId,
      requestCounts: new Array(NUM_BUCKETS).fill(0) as number[],
      errorRate: 0,
      endpoints: new Set(),
      lastSeen: Date.now(),
      anomalyScore: 0,
    };
    userBaselines.set(userId, bl);
  }
  return bl;
}

function ensureIpBaseline(ip: string): IpBaseline {
  let bl = ipBaselines.get(ip);
  if (!bl) {
    bl = {
      ip,
      requestCounts: new Array(NUM_BUCKETS).fill(0) as number[],
      distinctUsers: new Set(),
      distinctEndpoints: new Set(),
      lastSeen: Date.now(),
      anomalyScore: 0,
    };
    ipBaselines.set(ip, bl);
  }
  return bl;
}

function computeUserAnomalyScore(bl: UserBaseline, currentCount: number): number {
  const counts = bl.requestCounts.filter(c => c > 0);

  let score = 0;

  if (counts.length >= 3) {
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > 0 && currentCount > mean + 3 * stdDev) score += 40;
    else if (stdDev > 0 && currentCount > mean + 2 * stdDev) score += 20;
  } else {
    // Single-bucket spike: flag if very high absolute count in one window
    if (currentCount > 50) score += 40;
    else if (currentCount >= 20) score += 20;
  }

  // High error rate (accumulated via EMA — works with any number of requests)
  if (bl.errorRate > 0.5) score += 30;
  else if (bl.errorRate > 0.3) score += 15;

  // Endpoint sprawl (accessing many distinct endpoints rapidly)
  if (bl.endpoints.size > 50) score += 20;
  else if (bl.endpoints.size > 20) score += 10;

  return Math.min(score, 100);
}

function computeIpAnomalyScore(bl: IpBaseline, currentCount: number): number {
  const counts = bl.requestCounts.filter(c => c > 0);

  let score = 0;

  if (counts.length >= 3) {
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0 && currentCount > mean + 3 * stdDev) score += 30;
  }

  // IP serving many distinct users (botnet / credential stuffing)
  if (bl.distinctUsers.size > 20) score += 40;
  else if (bl.distinctUsers.size > 10) score += 20;

  if (bl.distinctEndpoints.size > 100) score += 30;

  return Math.min(score, 100);
}

export function recordRequest(opts: {
  userId?: string;
  ip: string;
  endpoint: string;
  statusCode: number;
}): { userAnomaly: number; ipAnomaly: number } {
  const bucket = currentBucket();
  const isError = opts.statusCode >= 400;

  let userAnomaly = 0;
  if (opts.userId) {
    const bl = ensureUserBaseline(opts.userId);
    const idx = getBucketIndex(bucket, bl);

    // Reset stale buckets (> NUM_BUCKETS old)
    const lastBucket = Math.floor(bl.lastSeen / BUCKET_MS);
    if (bucket > lastBucket) {
      // Clear buckets that are now stale
      for (let b = lastBucket + 1; b <= bucket && b - lastBucket < NUM_BUCKETS; b++) {
        bl.requestCounts[getBucketIndex(b, bl)] = 0;
      }
    }

    bl.requestCounts[idx] = (bl.requestCounts[idx] ?? 0) + 1;
    bl.endpoints.add(opts.endpoint);
    bl.lastSeen = Date.now();

    // Rolling error rate (EMA)
    bl.errorRate = bl.errorRate * 0.9 + (isError ? 0.1 : 0);

    const currentCount = bl.requestCounts[idx] ?? 0;
    bl.anomalyScore = computeUserAnomalyScore(bl, currentCount);
    userAnomaly = bl.anomalyScore;

    if (bl.anomalyScore >= CRITICAL_ANOMALY_THRESHOLD) {
      logSecurityEvent({
        type: 'suspicious_request',
        severity: 'critical',
        userId: opts.userId,
        ip: opts.ip,
        route: opts.endpoint,
        reason: `Critical anomaly score: ${bl.anomalyScore} — possible account compromise or automated abuse`,
      });
    } else if (bl.anomalyScore >= HIGH_ANOMALY_THRESHOLD) {
      logSecurityEvent({
        type: 'suspicious_request',
        severity: 'warn',
        userId: opts.userId,
        ip: opts.ip,
        route: opts.endpoint,
        reason: `High anomaly score: ${bl.anomalyScore}`,
      });
    }
  }

  // IP-level analysis
  const ipBl = ensureIpBaseline(opts.ip);
  const ipIdx = getBucketIndex(bucket, ipBl);
  const lastIpBucket = Math.floor(ipBl.lastSeen / BUCKET_MS);
  if (bucket > lastIpBucket) {
    for (let b = lastIpBucket + 1; b <= bucket && b - lastIpBucket < NUM_BUCKETS; b++) {
      ipBl.requestCounts[getBucketIndex(b, ipBl)] = 0;
    }
  }
  ipBl.requestCounts[ipIdx] = (ipBl.requestCounts[ipIdx] ?? 0) + 1;
  if (opts.userId) ipBl.distinctUsers.add(opts.userId);
  ipBl.distinctEndpoints.add(opts.endpoint);
  ipBl.lastSeen = Date.now();

  const ipCurrentCount = ipBl.requestCounts[ipIdx] ?? 0;
  ipBl.anomalyScore = computeIpAnomalyScore(ipBl, ipCurrentCount);

  return { userAnomaly, ipAnomaly: ipBl.anomalyScore };
}

export function getUserAnomalyScore(userId: string): number {
  return userBaselines.get(userId)?.anomalyScore ?? 0;
}

export function getIpAnomalyScore(ip: string): number {
  return ipBaselines.get(ip)?.anomalyScore ?? 0;
}

export function getAnomalyStats(): {
  trackedUsers: number;
  trackedIPs: number;
  highRiskUsers: string[];
  highRiskIPs: string[];
} {
  const highRiskUsers: string[] = [];
  const highRiskIPs: string[] = [];

  for (const [id, bl] of userBaselines.entries()) {
    if (bl.anomalyScore >= HIGH_ANOMALY_THRESHOLD) highRiskUsers.push(id);
  }
  for (const [ip, bl] of ipBaselines.entries()) {
    if (bl.anomalyScore >= HIGH_ANOMALY_THRESHOLD) highRiskIPs.push(ip);
  }

  return {
    trackedUsers: userBaselines.size,
    trackedIPs: ipBaselines.size,
    highRiskUsers,
    highRiskIPs,
  };
}

// Cleanup stale baselines every hour
const _cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2h
  for (const [id, bl] of userBaselines.entries()) {
    if (bl.lastSeen < cutoff) userBaselines.delete(id);
  }
  for (const [ip, bl] of ipBaselines.entries()) {
    if (bl.lastSeen < cutoff) ipBaselines.delete(ip);
  }
}, 60 * 60 * 1000);
if (typeof _cleanupTimer.unref === 'function') _cleanupTimer.unref();
