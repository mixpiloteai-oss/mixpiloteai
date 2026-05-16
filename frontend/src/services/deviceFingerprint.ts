// ============================================================
// NEUROTEK AI — Client-Side Device Fingerprint
// Generates a stable device fingerprint from browser properties.
// NOT cryptographically secure — for basic device tracking only.
// ============================================================

let cachedFingerprint: string | null = null;

export async function getDeviceFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint;

  // Try canvas fingerprint
  let canvasHash = 'no-canvas';
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('NEUROTEK AI', 2, 15);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('fingerprint', 4, 17);
      canvasHash = canvas.toDataURL().slice(0, 64);
    }
  } catch {
    // Canvas blocked by privacy settings
  }

  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.languages?.join(',') ?? '',
    `${screen.width}x${screen.height}`,
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(navigator.hardwareConcurrency ?? 0),
    String((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 0),
    String(navigator.maxTouchPoints ?? 0),
    canvasHash,
    String(navigator.plugins?.length ?? 0),
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(components);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);

  cachedFingerprint = fingerprint;
  return fingerprint;
}

export function warmFingerprint(): void {
  getDeviceFingerprint().catch(() => {
    // Ignore errors during warm-up
  });
}
