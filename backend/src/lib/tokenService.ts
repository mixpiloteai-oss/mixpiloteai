// ============================================================
// NEUROTEK AI — Secure Token Service
// ============================================================
// Hardened JWT and refresh token management:
//
// - Token rotation on refresh (old refresh token becomes invalid)
// - Refresh tokens hashed before DB storage (sha256)
// - JWT includes iss/aud/jti claims for proper validation
// - Token revocation via blacklist (jti)
// - Constant-time comparison for token verification
// - Refresh token family tracking (detect token reuse attacks)
// ============================================================

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  REFRESH_EXPIRES_IN,
} from './config';

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret';

// Fail-fast if running production with insecure secrets
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.includes('dev-')) {
    throw new Error('JWT_REFRESH_SECRET is missing or insecure in production');
  }
  if (JWT_REFRESH_SECRET === JWT_SECRET) {
    throw new Error('JWT_REFRESH_SECRET must differ from JWT_SECRET');
  }
}

const ISSUER   = process.env.JWT_ISSUER   ?? 'neurotek-ai';
const AUDIENCE = process.env.JWT_AUDIENCE ?? 'neurotek-ai-clients';

export interface AccessTokenPayload {
  id:    string;
  email: string;
  name:  string;
  plan:  string;
  iat?:  number;
  exp?:  number;
  jti?:  string;
}

export interface RefreshTokenPayload {
  id:       string;
  jti:      string;   // token unique ID for revocation
  family:   string;   // token family ID — detect reuse attacks
  iat?:     number;
  exp?:     number;
}

// ── In-memory revocation list (production should use Redis) ──────────────────
const revokedJtis = new Set<string>();

// Auto-prune every 1h (token TTL is typically 7d, but in-memory is bounded)
setInterval(() => {
  if (revokedJtis.size > 10_000) {
    // FIFO eviction — clear oldest half
    const arr = Array.from(revokedJtis);
    revokedJtis.clear();
    for (const j of arr.slice(arr.length / 2)) revokedJtis.add(j);
  }
}, 60 * 60 * 1000).unref?.();

// ── Token generation ─────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random JTI (JWT ID).
 */
function generateJti(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash a refresh token for safe DB storage.
 * Uses SHA-256 — fast and non-reversible. The original token is required
 * to validate, so an attacker reading the DB cannot use stored hashes.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Sign an access token with proper claims.
 */
export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'jti'>): string {
  const jti = generateJti();
  return jwt.sign(
    { ...payload, jti },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      issuer:   ISSUER,
      audience: AUDIENCE,
    }
  );
}

/**
 * Sign a refresh token with family tracking.
 * `family` ties together a chain of refresh tokens — if one is reused
 * after rotation, we can detect a theft and revoke the entire family.
 */
export function signRefreshToken(userId: string, family?: string): { token: string; jti: string; family: string } {
  const jti = generateJti();
  const fam = family ?? generateJti();
  const token = jwt.sign(
    { id: userId, jti, family: fam },
    JWT_REFRESH_SECRET,
    {
      expiresIn: REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      issuer:    ISSUER,
      audience:  AUDIENCE,
    }
  );
  return { token, jti, family: fam };
}

// ── Token verification ───────────────────────────────────────────────────────

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer:   ISSUER,
      audience: AUDIENCE,
    }) as AccessTokenPayload;

    if (payload.jti && revokedJtis.has(payload.jti)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer:   ISSUER,
      audience: AUDIENCE,
    }) as RefreshTokenPayload;

    if (revokedJtis.has(payload.jti)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ── Revocation ───────────────────────────────────────────────────────────────

export function revokeJti(jti: string): void {
  revokedJtis.add(jti);
}

export function isRevoked(jti: string): boolean {
  return revokedJtis.has(jti);
}

/**
 * Compare two tokens in constant time to prevent timing attacks.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Compare a plaintext refresh token with its stored hash.
 */
export function verifyRefreshTokenHash(plaintext: string, storedHash: string): boolean {
  const computed = hashRefreshToken(plaintext);
  return constantTimeEquals(computed, storedHash);
}
