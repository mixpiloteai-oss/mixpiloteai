// ============================================================
// NEUROTEK AI — License Routes
// ============================================================
import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateLicense, generateFingerprint, getLicenseForUser, ensureLicenseForUser, revokeDevice, getDeviceCount, LicensePlan } from '../services/licenseService';

const router = Router();
router.use(requireAuth as any);

router.get('/status', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const plan = (req.user!.plan ?? 'free') as LicensePlan;
  const license = ensureLicenseForUser(userId, plan);
  const deviceCount = getDeviceCount(license.licenseKey);
  res.json({ success: true, data: { licenseKey: license.licenseKey, plan: license.plan, isValid: !license.isRevoked && (license.expiresAt == null || new Date(license.expiresAt) > new Date()), isRevoked: license.isRevoked, expiresAt: license.expiresAt, issuedAt: license.issuedAt, lastValidatedAt: license.lastValidatedAt, deviceCount, maxDevices: license.maxDevices, devices: license.deviceIds } });
});

router.post('/validate', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const plan = (req.user!.plan ?? 'free') as LicensePlan;
  const deviceFingerprint: string = req.body?.deviceFingerprint ?? generateFingerprint(req);
  const license = ensureLicenseForUser(userId, plan);
  const result = validateLicense(license.licenseKey, deviceFingerprint, userId);
  if (!result.valid) return res.status(403).json({ success: false, error: result.reason, code: 'LICENSE_INVALID' });
  res.json({ success: true, data: { valid: true, plan: result.license!.plan, licenseKey: result.license!.licenseKey, deviceCount: result.license!.deviceIds.length, maxDevices: result.license!.maxDevices, expiresAt: result.license!.expiresAt } });
});

router.post('/activate', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const plan = (req.user!.plan ?? 'free') as LicensePlan;
  const { deviceFingerprint, licenseKey } = req.body ?? {};
  if (!deviceFingerprint) return res.status(400).json({ success: false, error: 'deviceFingerprint is required' });
  const license = ensureLicenseForUser(userId, plan);
  const result = validateLicense(licenseKey ?? license.licenseKey, deviceFingerprint, userId);
  if (!result.valid) return res.status(403).json({ success: false, error: result.reason, code: 'LICENSE_INVALID' });
  res.json({ success: true, message: 'License activated on this device', data: { plan: result.license!.plan, licenseKey: result.license!.licenseKey, deviceCount: result.license!.deviceIds.length, maxDevices: result.license!.maxDevices } });
});

router.get('/devices', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const plan = (req.user!.plan ?? 'free') as LicensePlan;
  const license = ensureLicenseForUser(userId, plan);
  res.json({ success: true, data: { devices: license.deviceIds.map((fp, idx) => ({ id: fp, label: `Device ${idx + 1}`, fingerprint: fp })), count: license.deviceIds.length, maxDevices: license.maxDevices } });
});

router.post('/revoke-device', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { deviceFingerprint } = req.body ?? {};
  if (!deviceFingerprint) return res.status(400).json({ success: false, error: 'deviceFingerprint is required' });
  const ok = revokeDevice(userId, deviceFingerprint);
  if (!ok) return res.status(404).json({ success: false, error: 'Device not found on this license' });
  res.json({ success: true, message: 'Device removed from license' });
});

export default router;
