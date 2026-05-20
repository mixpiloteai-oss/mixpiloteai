// ============================================================
// NEUROTEK AI — Centralised config constants
// ============================================================

export const JWT_SECRET = process.env.JWT_SECRET ?? 'neurotek-dev-secret-change-in-production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';
export const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN ?? '30d';
