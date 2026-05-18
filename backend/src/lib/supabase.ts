import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const isSupabaseConfigured = !!(url && key && !url.includes('REPLACE'));

// Only create client if credentials are present
export const supabase = isSupabaseConfigured
  ? createClient(url, key, { auth: { persistSession: false } })
  : null;
