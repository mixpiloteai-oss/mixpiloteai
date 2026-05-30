// ============================================================
// NEUROTEK AI — Upload Sandbox Middleware
// ============================================================
// MIME type validation using magic bytes (not just Content-Type).
// Protects against MIME spoofing attacks where an attacker sends
// a malicious file with a trusted Content-Type header.
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from '../utils/securityLog';

// Allowed MIME types for audio uploads
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/aiff', 'audio/x-aiff', 'audio/flac', 'audio/x-flac',
  'audio/ogg', 'audio/opus', 'audio/webm', 'audio/mp4', 'audio/aac',
]);

// Allowed MIME types for image uploads
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
]);

// Allowed MIME types for plugin/preset uploads
const ALLOWED_PRESET_MIMES = new Set([
  'application/json', 'application/xml', 'text/xml', 'text/plain',
  'application/octet-stream',
]);

// Magic bytes signatures for common file types
const MAGIC_BYTES: Array<{ mime: string; offset: number; bytes: number[] }> = [
  // MP3 - ID3 header
  { mime: 'audio/mpeg', offset: 0, bytes: [0x49, 0x44, 0x33] },
  // MP3 - MPEG sync
  { mime: 'audio/mpeg', offset: 0, bytes: [0xFF, 0xFB] },
  { mime: 'audio/mpeg', offset: 0, bytes: [0xFF, 0xF3] },
  { mime: 'audio/mpeg', offset: 0, bytes: [0xFF, 0xF2] },
  // WAV - RIFF
  { mime: 'audio/wav', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
  // FLAC
  { mime: 'audio/flac', offset: 0, bytes: [0x66, 0x4C, 0x61, 0x43] },
  // OGG
  { mime: 'audio/ogg', offset: 0, bytes: [0x4F, 0x67, 0x67, 0x53] },
  // AIFF - FORM
  { mime: 'audio/aiff', offset: 0, bytes: [0x46, 0x4F, 0x52, 0x4D] },
  // JPEG
  { mime: 'image/jpeg', offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
  // PNG
  { mime: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47] },
  // GIF
  { mime: 'image/gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  // WebP - RIFF...WEBP
  { mime: 'image/webp', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
  // PDF (reject for audio context)
  { mime: 'application/pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  // EXE / PE
  { mime: 'application/x-msdownload', offset: 0, bytes: [0x4D, 0x5A] },
  // ELF (Linux executable)
  { mime: 'application/x-elf', offset: 0, bytes: [0x7F, 0x45, 0x4C, 0x46] },
  // ZIP (could be JAR, DOCX, etc.)
  { mime: 'application/zip', offset: 0, bytes: [0x50, 0x4B, 0x03, 0x04] },
  // JSON
  { mime: 'application/json', offset: 0, bytes: [0x7B] }, // starts with {
  { mime: 'application/json', offset: 0, bytes: [0x5B] }, // starts with [
];

// Dangerous MIME types that should never be accepted
const DANGEROUS_MIMES = new Set([
  'application/x-msdownload', 'application/x-executable', 'application/x-elf',
  'application/x-sh', 'text/x-sh', 'application/x-php', 'text/x-php',
  'application/javascript', 'text/javascript', 'application/x-javascript',
  'application/x-python', 'text/x-python', 'application/x-perl',
  'application/x-ruby', 'application/x-bat', 'application/x-msdos-program',
]);

export function detectMimeFromBytes(buffer: Buffer): string | null {
  for (const sig of MAGIC_BYTES) {
    const slice = buffer.slice(sig.offset, sig.offset + sig.bytes.length);
    if (slice.length === sig.bytes.length && sig.bytes.every((b, i) => slice[i] === b)) {
      return sig.mime;
    }
  }
  return null;
}

export function isMimeSpoofed(claimedMime: string, actualMime: string | null): boolean {
  if (!actualMime) return false;
  const claimed = claimedMime.toLowerCase().split(';')[0]?.trim() ?? '';
  const actual = actualMime.toLowerCase();

  // Same base type family — acceptable
  if (claimed === actual) return false;
  if (claimed.startsWith('audio/') && actual.startsWith('audio/')) return false;
  if (claimed.startsWith('image/') && actual.startsWith('image/')) return false;

  // Claimed safe but actually dangerous
  if (DANGEROUS_MIMES.has(actual)) return true;

  // Cross-category mismatch (e.g., claimed audio but actually image)
  const claimedFamily = claimed.split('/')[0];
  const actualFamily = actual.split('/')[0];
  if (claimedFamily !== actualFamily && claimedFamily !== 'application') return true;

  return false;
}

/**
 * Middleware to validate upload MIME types.
 * Checks Content-Type header and (when body is available) magic bytes.
 * Use on upload routes.
 */
export function validateUploadMime(
  allowedMimes: Set<string> = ALLOWED_AUDIO_MIMES
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.headers['content-type'] ?? '';
    const mimeType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';

    // Reject dangerous MIME types immediately
    if (DANGEROUS_MIMES.has(mimeType)) {
      logSecurityEvent({
        type: 'file_rejected',
        severity: 'warn',
        ip: req.ip,
        route: req.path,
        reason: `Dangerous MIME type rejected: ${mimeType}`,
      });
      res.status(415).json({
        success: false,
        error: 'File type not allowed',
        code: 'MIME_REJECTED',
      });
      return;
    }

    // For multipart uploads, skip body check (handled by multer)
    if (mimeType === 'multipart/form-data') {
      next();
      return;
    }

    // Check if claimed MIME is in allowlist
    if (mimeType && !allowedMimes.has(mimeType)) {
      logSecurityEvent({
        type: 'file_rejected',
        severity: 'warn',
        ip: req.ip,
        route: req.path,
        reason: `Disallowed MIME type: ${mimeType}`,
      });
      res.status(415).json({
        success: false,
        error: 'File type not allowed',
        code: 'MIME_NOT_ALLOWED',
      });
      return;
    }

    // If we have body bytes, perform magic byte check
    if (req.body instanceof Buffer && req.body.length >= 4) {
      const detectedMime = detectMimeFromBytes(req.body);
      if (isMimeSpoofed(mimeType, detectedMime)) {
        logSecurityEvent({
          type: 'file_rejected',
          severity: 'critical',
          ip: req.ip,
          route: req.path,
          reason: `MIME spoof detected: claimed=${mimeType}, actual=${detectedMime}`,
        });
        res.status(400).json({
          success: false,
          error: 'File content does not match declared type',
          code: 'MIME_SPOOF',
        });
        return;
      }
    }

    next();
  };
}

export { ALLOWED_AUDIO_MIMES, ALLOWED_IMAGE_MIMES, ALLOWED_PRESET_MIMES };
