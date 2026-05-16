// ============================================================
// NEUROTEK AI — License Check Middleware
// ============================================================
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { getLicenseForUser } from '../services/licenseService';

export interface LicensedRequest extends AuthenticatedRequest {
  license?: ReturnType<typeof getLicenseForUser>;
}

export function requireActiveLicense(
  req: LicensedRequest,
  res: Response,
  next: NextFunction
): void {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorised' });
    return;
  }

  const license = getLicenseForUser(userId);
  if (!license) {
    res.status(403).json({ success: false, error: 'No license found', code: 'NO_LICENSE' });
    return;
  }

  if (license.isRevoked) {
    res.status(403).json({ success: false, error: 'License revoked', code: 'LICENSE_REVOKED' });
    return;
  }

  if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
    res.status(403).json({ success: false, error: 'License expired', code: 'LICENSE_EXPIRED' });
    return;
  }

  req.license = license;
  next();
}

export function requirePremiumLicense(
  req: LicensedRequest,
  res: Response,
  next: NextFunction
): void {
  requireActiveLicense(req, res, () => {
    const plan = req.user?.plan ?? 'free';
    if (plan === 'free') {
      res.status(403).json({
        success: false,
        error: 'This feature requires a Pro or Studio plan',
        code: 'PREMIUM_REQUIRED',
      });
      return;
    }
    next();
  });
}
