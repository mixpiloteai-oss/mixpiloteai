// ============================================================
// NEUROTEK AI — Media URL Allowlist Guard
// ============================================================
// Validates that user-supplied media URLs point at known storage
// hosts. Prevents the marketplace from being used as a redirector
// to attacker-controlled domains.
// ============================================================

const DEFAULT_HOSTS = [
  'r2.cloudflarestorage.com',
  'mixpiloteai.com',
  'mixpiloteai-cdn.com',
];

function deriveSupabaseHost(): string | null {
  const url = process.env.SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function buildAllowlist(): string[] {
  const csv = process.env.MEDIA_HOSTS_ALLOWLIST ?? '';
  const fromEnv = csv
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const supa = deriveSupabaseHost();
  const merged = new Set<string>([
    ...DEFAULT_HOSTS,
    ...fromEnv,
    ...(supa ? [supa.toLowerCase()] : []),
  ]);
  return Array.from(merged);
}

export const MEDIA_HOSTS_ALLOWLIST: string[] = buildAllowlist();

export function isAllowedMediaUrl(url: string): boolean {
  if (typeof url !== 'string' || !url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  return MEDIA_HOSTS_ALLOWLIST.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

export type AssertUrlsResult =
  | { ok: true }
  | { ok: false; field: string };

export function assertAllowedMediaUrls(
  urls: Record<string, string | undefined>
): AssertUrlsResult {
  for (const [field, value] of Object.entries(urls)) {
    if (value === undefined || value === null || value === '') continue;
    if (!isAllowedMediaUrl(value)) {
      return { ok: false, field };
    }
  }
  return { ok: true };
}
