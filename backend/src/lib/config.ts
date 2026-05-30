// ============================================================
// NEUROTEK AI — Centralised config constants
// ============================================================

const raw = process.env.JWT_SECRET ?? '';

// Hard-fail if a known weak default reaches production.
// validateEnv() also checks this, but belt-and-suspenders here
// ensures the secret can never silently be a dev placeholder.
const WEAK_PATTERNS = ['dev-secret', 'change-in-production', 'placeholder', 'neurotek-dev', 'your-'];
if (process.env.NODE_ENV === 'production' && WEAK_PATTERNS.some(p => raw.includes(p))) {
  console.error('[FATAL] JWT_SECRET is an insecure default in production. Refusing to start.');
  process.exit(1);
}

export const JWT_SECRET = raw || 'neurotek-dev-secret-change-in-production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';
export const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN ?? '30d';
