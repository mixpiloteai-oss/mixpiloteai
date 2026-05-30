// ============================================================
// Auth helpers for tests.
// ============================================================
import './env.ts';

export function randomEmail(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

export interface RegisteredUser {
  email: string;
  password: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; plan: string };
}

export async function registerAndLogin(baseUrl: string, overrides: Partial<{ email: string; password: string; name: string }> = {}): Promise<RegisteredUser> {
  const email = overrides.email ?? randomEmail();
  const password = overrides.password ?? 'TestPassword123!';
  const name = overrides.name ?? 'Test User';

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  const body = await res.json() as {
    success: boolean;
    data?: {
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; name: string; plan: string };
    };
    error?: string;
  };
  if (!res.ok || !body.success || !body.data) {
    throw new Error(`registerAndLogin failed: ${res.status} ${body.error ?? 'unknown'}`);
  }
  return { email, password, name, ...body.data };
}

export function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export function adminHeaders(): Record<string, string> {
  return { 'x-admin-key': process.env.ADMIN_KEY ?? '' };
}
