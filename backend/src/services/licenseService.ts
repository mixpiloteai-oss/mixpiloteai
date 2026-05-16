// ============================================================
// NEUROTEK AI — License Service
// ============================================================
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Request } from 'express';

export type LicensePlan = 'free' | 'pro' | 'studio';

export interface LicenseRecord {
  licenseKey: string;
  userId: string;
  plan: LicensePlan;
  issuedAt: string;
  expiresAt: string | null;
  isRevoked: boolean;
  deviceIds: string[];
  maxDevices: number;
  lastValidatedAt: string | null;
}

const MAX_DEVICES: Record<LicensePlan, number> = {
  free: 1,
  pro: 3,
  studio: 5,
};

const licenseStore: Map<string, LicenseRecord> = new Map();
const userLicenseMap: Map<string, string> = new Map();

export function generateLicense(userId: string, plan: LicensePlan): LicenseRecord {
  const licenseKey = `NT-${plan.toUpperCase()}-${uuidv4().toUpperCase().slice(0, 8)}-${uuidv4().toUpperCase().slice(0, 8)}`;

  const record: LicenseRecord = {
    licenseKey,
    userId,
    plan,
    issuedAt: new Date().toISOString(),
    expiresAt: plan === 'free' ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    isRevoked: false,
    deviceIds: [],
    maxDevices: MAX_DEVICES[plan],
    lastValidatedAt: null,
  };

  licenseStore.set(licenseKey, record);
  userLicenseMap.set(userId, licenseKey);
  return record;
}

export function getLicenseForUser(userId: string): LicenseRecord | null {
  const key = userLicenseMap.get(userId);
  if (!key) return null;
  return licenseStore.get(key) ?? null;
}

export function ensureLicenseForUser(userId: string, plan: LicensePlan): LicenseRecord {
  const existing = getLicenseForUser(userId);
  if (existing) return existing;
  return generateLicense(userId, plan);
}

export function validateLicense(
  licenseKey: string,
  deviceFingerprint: string,
  userId: string
): { valid: boolean; reason?: string; license?: LicenseRecord } {
  const record = licenseStore.get(licenseKey);

  if (!record) return { valid: false, reason: 'License key not found' };
  if (record.userId !== userId) return { valid: false, reason: 'License not owned by this user' };
  if (record.isRevoked) return { valid: false, reason: 'License has been revoked' };
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) return { valid: false, reason: 'License has expired' };

  if (!record.deviceIds.includes(deviceFingerprint)) {
    if (record.deviceIds.length >= record.maxDevices) {
      return { valid: false, reason: `Device limit reached (${record.maxDevices} devices max)` };
    }
    record.deviceIds.push(deviceFingerprint);
  }

  record.lastValidatedAt = new Date().toISOString();
  return { valid: true, license: record };
}

export function revokeLicense(licenseKey: string): boolean {
  const record = licenseStore.get(licenseKey);
  if (!record) return false;
  record.isRevoked = true;
  return true;
}

export function revokeDevice(userId: string, deviceFingerprint: string): boolean {
  const key = userLicenseMap.get(userId);
  if (!key) return false;
  const record = licenseStore.get(key);
  if (!record) return false;
  const idx = record.deviceIds.indexOf(deviceFingerprint);
  if (idx === -1) return false;
  record.deviceIds.splice(idx, 1);
  return true;
}

export function getDeviceCount(licenseKey: string): number {
  return licenseStore.get(licenseKey)?.deviceIds.length ?? 0;
}

export function generateFingerprint(req: Request): string {
  const parts = [
    req.headers['user-agent'] ?? '',
    req.headers['accept-language'] ?? '',
    req.ip ?? '',
  ].join('|');
  return crypto.createHash('sha256').update(parts).digest('hex').slice(0, 32);
}
