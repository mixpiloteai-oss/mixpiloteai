// ============================================================
// NEUROTEK AI — Upload Validation Helpers
// ============================================================
// Pure functions intended to be called from route handlers that
// receive file uploads. The backend does not currently use multer,
// so these helpers operate on already-extracted metadata + buffers.
// ============================================================

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_AUDIO_MIME = new Set<string>([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/flac',
  'audio/x-flac',
  'audio/ogg',
  'audio/aiff',
  'audio/x-aiff',
]);

export const ALLOWED_IMAGE_MIME = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

export interface ValidateUploadInput {
  mimeType: string;
  size: number;
  allowed: Set<string>;
  maxSize?: number;
}

export type ValidateUploadResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateUpload(input: ValidateUploadInput): ValidateUploadResult {
  const { mimeType, size, allowed } = input;
  const maxSize = input.maxSize ?? MAX_UPLOAD_SIZE;

  if (!mimeType || typeof mimeType !== 'string') {
    return { ok: false, reason: 'Missing mime type' };
  }
  const normalized = mimeType.toLowerCase().trim();
  if (!allowed.has(normalized)) {
    return { ok: false, reason: `Mime type not allowed: ${normalized}` };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, reason: 'Invalid file size' };
  }
  if (size > maxSize) {
    return { ok: false, reason: `File too large (max ${maxSize} bytes)` };
  }
  return { ok: true };
}

/**
 * Strip path separators, control characters, leading dots and
 * collapse to a safe filename of at most 255 chars. The returned
 * string is never empty — falls back to "file" if everything is
 * stripped.
 */
export function sanitizeFilename(name: string): string {
  if (typeof name !== 'string') return 'file';

  // Drop any directory component, on any OS.
  let base = name.replace(/\\/g, '/').split('/').pop() ?? '';

  // Remove control chars (0x00–0x1F, 0x7F) and dangerous chars.
  // eslint-disable-next-line no-control-regex
  base = base.replace(/[\x00-\x1F\x7F<>:"|?*]/g, '');

  // Strip leading dots (dotfiles) and whitespace.
  base = base.replace(/^[.\s]+/, '').trim();

  if (!base) return 'file';
  if (base.length > 255) base = base.slice(0, 255);
  return base;
}

export type MagicKind = 'wav' | 'mp3' | 'png' | 'jpg';

/**
 * Lightweight magic-byte sniffer. Only inspects the leading bytes —
 * sufficient as a cheap second line of defence after mime checks.
 */
export function looksLikeMagicBytes(buf: Buffer, expected: MagicKind): boolean {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return false;

  switch (expected) {
    case 'wav':
      // "RIFF" .... "WAVE"
      return (
        buf.length >= 12 &&
        buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45
      );
    case 'mp3':
      // ID3 tag header or MPEG frame sync (FF Fx).
      if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
      if (buf[0] === 0xff && buf[1] !== undefined && (buf[1] & 0xe0) === 0xe0) return true;
      return false;
    case 'png':
      // 89 50 4E 47 0D 0A 1A 0A
      return (
        buf.length >= 8 &&
        buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
        buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
      );
    case 'jpg':
      // FF D8 FF
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    default:
      return false;
  }
}
