// ============================================================
// NEUROTEK AI — Monitoring Service
// ============================================================

export interface SystemMetric {
  timestamp: number;
  cpuPct: number;
  ramUsedMB: number;
  ramTotalMB: number;
  requestsPerMin: number;
  errorRate: number;
  p95LatencyMs: number;
  activeConnections: number;
  dbQueryMs: number;
}

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  uptime: string;
  lastCheck: number;
  errorCount24h: number;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  operator: '>' | '<' | '>=' | '<=';
  severity: 'info' | 'warning' | 'critical';
  active: boolean;
  triggeredAt?: number;
}

export interface ErrorLog {
  id: string;
  timestamp: number;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  endpoint?: string;
  userId?: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

// ── Circular buffer ──────────────────────────────────────────
const BUFFER_SIZE = 60;
const metricsBuffer: SystemMetric[] = [];

function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateMetric(): SystemMetric {
  const now = Date.now();
  const isSpike = Math.random() < 0.05; // 5% chance of a spike

  return {
    timestamp: now,
    cpuPct: isSpike ? rnd(80, 98) : rnd(15, 75),
    ramUsedMB: isSpike ? rnd(3200, 3800) : rnd(2048, 3584),
    ramTotalMB: 8192,
    requestsPerMin: isSpike ? rnd(300, 500) : rnd(20, 200),
    errorRate: isSpike ? rnd(0.04, 0.1) : rnd(0.001, 0.02),
    p95LatencyMs: isSpike ? rnd(500, 1200) : rnd(50, 350),
    activeConnections: Math.floor(rnd(10, 180)),
    dbQueryMs: isSpike ? rnd(200, 800) : rnd(3, 80),
  };
}

// ── Seed 60 historical entries ───────────────────────────────
function seedMetrics(): void {
  const now = Date.now();
  const interval = 30_000; // 30s
  for (let i = BUFFER_SIZE - 1; i >= 0; i--) {
    const m = generateMetric();
    m.timestamp = now - i * interval;
    metricsBuffer.push(m);
  }
}

seedMetrics();

// Collect a new metric every 30 seconds
setInterval(() => {
  const m = generateMetric();
  metricsBuffer.push(m);
  if (metricsBuffer.length > BUFFER_SIZE) {
    metricsBuffer.shift();
  }
}, 30_000);

// ── Public API ───────────────────────────────────────────────

export function getMetrics(last = 30): SystemMetric[] {
  return metricsBuffer.slice(-Math.min(last, BUFFER_SIZE));
}

export function getLatestMetric(): SystemMetric {
  return metricsBuffer[metricsBuffer.length - 1] ?? generateMetric();
}

const SERVICE_NAMES = [
  'API Gateway',
  'Database',
  'AI Service',
  'Storage',
  'Email',
  'Payment Gateway',
  'CDN',
  'WebSocket',
];

const uptimes = ['99.98%', '99.95%', '99.87%', '99.99%', '99.92%', '99.96%', '99.99%', '99.90%'];
const baseLatencies = [12, 4, 1340, 85, 340, 220, 18, 28];
const errorCounts = [2, 0, 12, 1, 3, 5, 0, 7];
const baseStatuses: ServiceStatus['status'][] = [
  'healthy',
  'healthy',
  'degraded',
  'healthy',
  'healthy',
  'healthy',
  'healthy',
  'degraded',
];

export function getServiceStatuses(): ServiceStatus[] {
  const now = Date.now();
  return SERVICE_NAMES.map((name, i) => ({
    name,
    status: baseStatuses[i],
    latencyMs: Math.round(baseLatencies[i] * (0.9 + Math.random() * 0.2)),
    uptime: uptimes[i],
    lastCheck: now - Math.floor(Math.random() * 30_000),
    errorCount24h: errorCounts[i],
  }));
}

// ── Alert Rules ──────────────────────────────────────────────

const alertRules: AlertRule[] = [
  {
    id: 'alert-001',
    name: 'High CPU',
    metric: 'cpuPct',
    threshold: 80,
    operator: '>',
    severity: 'warning',
    active: true,
  },
  {
    id: 'alert-002',
    name: 'Critical CPU',
    metric: 'cpuPct',
    threshold: 95,
    operator: '>',
    severity: 'critical',
    active: true,
  },
  {
    id: 'alert-003',
    name: 'High RAM',
    metric: 'ramUsedPct',
    threshold: 90,
    operator: '>',
    severity: 'warning',
    active: true,
  },
  {
    id: 'alert-004',
    name: 'High Error Rate',
    metric: 'errorRate',
    threshold: 0.05,
    operator: '>',
    severity: 'critical',
    active: true,
    triggeredAt: Date.now() - 3_600_000,
  },
  {
    id: 'alert-005',
    name: 'Slow Response',
    metric: 'p95LatencyMs',
    threshold: 500,
    operator: '>',
    severity: 'warning',
    active: true,
  },
  {
    id: 'alert-006',
    name: 'Low Request Rate',
    metric: 'requestsPerMin',
    threshold: 5,
    operator: '<',
    severity: 'info',
    active: false,
  },
];

export function getAlertRules(): AlertRule[] {
  return alertRules;
}

// ── Error Logs ───────────────────────────────────────────────

const errorLogs: ErrorLog[] = [
  {
    id: 'err-001',
    timestamp: Date.now() - 300_000,
    level: 'error',
    message: 'AI model response timeout after 30s',
    stack: 'Error: Request timeout\n    at AIGateway.request (/app/services/aiGateway.ts:128)',
    endpoint: '/api/ai/generate',
    count: 14,
    firstSeen: Date.now() - 3_600_000,
    lastSeen: Date.now() - 300_000,
  },
  {
    id: 'err-002',
    timestamp: Date.now() - 600_000,
    level: 'error',
    message: 'Stripe webhook signature verification failed',
    stack: 'Error: No signatures found matching the expected signature for payload\n    at stripeService.ts:45',
    endpoint: '/api/payments/stripe/webhook',
    count: 3,
    firstSeen: Date.now() - 7_200_000,
    lastSeen: Date.now() - 600_000,
  },
  {
    id: 'err-003',
    timestamp: Date.now() - 1_200_000,
    level: 'warn',
    message: 'JWT token expiry imminent for user session',
    endpoint: '/api/auth/refresh',
    userId: 'u-023',
    count: 47,
    firstSeen: Date.now() - 86_400_000,
    lastSeen: Date.now() - 1_200_000,
  },
  {
    id: 'err-004',
    timestamp: Date.now() - 1_800_000,
    level: 'error',
    message: 'File upload exceeds maximum size limit',
    stack: 'PayloadTooLargeError: request entity too large\n    at read (/app/node_modules/body-parser/lib/read.js:79)',
    endpoint: '/api/marketplace/upload',
    count: 8,
    firstSeen: Date.now() - 5 * 86_400_000,
    lastSeen: Date.now() - 1_800_000,
  },
  {
    id: 'err-005',
    timestamp: Date.now() - 2_400_000,
    level: 'error',
    message: 'Collaboration room not found during reconnect',
    stack: 'Error: Room undefined\n    at CollabService.joinRoom (/app/services/collaborationService.ts:213)',
    endpoint: '/api/collab/join',
    count: 22,
    firstSeen: Date.now() - 2 * 86_400_000,
    lastSeen: Date.now() - 2_400_000,
  },
  {
    id: 'err-006',
    timestamp: Date.now() - 3_000_000,
    level: 'warn',
    message: 'Rate limit reached for AI API key',
    endpoint: '/api/ai/generate',
    count: 5,
    firstSeen: Date.now() - 86_400_000,
    lastSeen: Date.now() - 3_000_000,
  },
  {
    id: 'err-007',
    timestamp: Date.now() - 3_600_000,
    level: 'error',
    message: 'PayPal order capture failed: INSTRUMENT_DECLINED',
    stack: 'PayPalError: INSTRUMENT_DECLINED\n    at paypalService.captureOrder (/app/services/paypalService.ts:88)',
    endpoint: '/api/payments/paypal/capture',
    userId: 'u-031',
    count: 4,
    firstSeen: Date.now() - 3 * 86_400_000,
    lastSeen: Date.now() - 3_600_000,
  },
  {
    id: 'err-008',
    timestamp: Date.now() - 7_200_000,
    level: 'error',
    message: 'Export job timed out in cloud render queue',
    stack: 'Error: Export job exceeded 5 minute timeout\n    at ExportService.poll (/app/services/exportService.ts:167)',
    endpoint: '/api/export/status',
    count: 11,
    firstSeen: Date.now() - 4 * 86_400_000,
    lastSeen: Date.now() - 7_200_000,
  },
  {
    id: 'err-009',
    timestamp: Date.now() - 10_800_000,
    level: 'warn',
    message: 'Missing required field "bpm" in project creation',
    endpoint: '/api/projects',
    count: 19,
    firstSeen: Date.now() - 7 * 86_400_000,
    lastSeen: Date.now() - 10_800_000,
  },
  {
    id: 'err-010',
    timestamp: Date.now() - 14_400_000,
    level: 'error',
    message: 'bcrypt hash comparison failed — corrupted password hash',
    stack: 'Error: data and hash arguments required\n    at bcrypt.compare (/app/node_modules/bcryptjs/dist/bcrypt.js:125)',
    endpoint: '/api/auth/login',
    count: 2,
    firstSeen: Date.now() - 5 * 86_400_000,
    lastSeen: Date.now() - 14_400_000,
  },
  {
    id: 'err-011',
    timestamp: Date.now() - 18_000_000,
    level: 'info',
    message: 'Suspicious login attempt blocked by fraud service',
    endpoint: '/api/auth/login',
    count: 63,
    firstSeen: Date.now() - 14 * 86_400_000,
    lastSeen: Date.now() - 18_000_000,
  },
  {
    id: 'err-012',
    timestamp: Date.now() - 21_600_000,
    level: 'error',
    message: 'CORS error: origin not in allowlist',
    stack: 'Error: CORS: origin https://evil.com not allowed\n    at corsMiddleware',
    endpoint: '/api/auth/login',
    count: 7,
    firstSeen: Date.now() - 2 * 86_400_000,
    lastSeen: Date.now() - 21_600_000,
  },
  {
    id: 'err-013',
    timestamp: Date.now() - 25_200_000,
    level: 'warn',
    message: 'Coupon usage limit almost reached: LAUNCH50',
    count: 1,
    firstSeen: Date.now() - 25_200_000,
    lastSeen: Date.now() - 25_200_000,
  },
  {
    id: 'err-014',
    timestamp: Date.now() - 28_800_000,
    level: 'error',
    message: 'Chunk upload out of order — missing chunk 3/8',
    stack: 'Error: Missing chunk index 3\n    at chunkService.ts:99',
    endpoint: '/api/chunks/upload',
    count: 6,
    firstSeen: Date.now() - 3 * 86_400_000,
    lastSeen: Date.now() - 28_800_000,
  },
  {
    id: 'err-015',
    timestamp: Date.now() - 32_400_000,
    level: 'warn',
    message: 'Template save failed: duplicate template name',
    endpoint: '/api/templates',
    userId: 'u-008',
    count: 3,
    firstSeen: Date.now() - 32_400_000,
    lastSeen: Date.now() - 32_400_000,
  },
  {
    id: 'err-016',
    timestamp: Date.now() - 36_000_000,
    level: 'error',
    message: 'AI context length exceeded: tokens > 200000',
    stack: 'Error: Context window exceeded\n    at aiGateway.ts:220',
    endpoint: '/api/ai/generate',
    count: 9,
    firstSeen: Date.now() - 6 * 86_400_000,
    lastSeen: Date.now() - 36_000_000,
  },
  {
    id: 'err-017',
    timestamp: Date.now() - 43_200_000,
    level: 'error',
    message: 'Invoice PDF generation failed: undefined customerAddress',
    stack: 'TypeError: Cannot read properties of undefined\n    at invoiceService.ts:178',
    endpoint: '/api/subscriptions/invoice',
    count: 4,
    firstSeen: Date.now() - 8 * 86_400_000,
    lastSeen: Date.now() - 43_200_000,
  },
  {
    id: 'err-018',
    timestamp: Date.now() - 50_400_000,
    level: 'warn',
    message: 'Slow DB query detected: 320ms for user lookup',
    endpoint: '/api/projects',
    count: 28,
    firstSeen: Date.now() - 10 * 86_400_000,
    lastSeen: Date.now() - 50_400_000,
  },
  {
    id: 'err-019',
    timestamp: Date.now() - 57_600_000,
    level: 'error',
    message: 'SSE connection dropped unexpectedly',
    stack: 'Error: write ECONNRESET\n    at collabRoute.ts:67',
    endpoint: '/api/collab/events',
    count: 31,
    firstSeen: Date.now() - 12 * 86_400_000,
    lastSeen: Date.now() - 57_600_000,
  },
  {
    id: 'err-020',
    timestamp: Date.now() - 64_800_000,
    level: 'info',
    message: 'New admin key used from unrecognized IP',
    count: 1,
    firstSeen: Date.now() - 64_800_000,
    lastSeen: Date.now() - 64_800_000,
  },
];

export function getErrorLogs(limit = 20): ErrorLog[] {
  return errorLogs.slice(0, limit);
}

export function getStorageInfo(): {
  usedGB: number;
  totalGB: number;
  breakdown: { label: string; gb: number; color: string }[];
} {
  return {
    usedGB: 100,
    totalGB: 500,
    breakdown: [
      { label: 'Audio Files', gb: 45, color: '#6366f1' },
      { label: 'User Uploads', gb: 28, color: '#8b5cf6' },
      { label: 'Backups', gb: 18, color: '#a78bfa' },
      { label: 'Logs', gb: 4, color: '#c4b5fd' },
      { label: 'System', gb: 3, color: '#ddd6fe' },
      { label: 'Other', gb: 2, color: '#ede9fe' },
    ],
  };
}
