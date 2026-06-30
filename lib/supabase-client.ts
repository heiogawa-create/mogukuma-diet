import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder';

// シングルトンでインスタンスを管理
const globalForSupabase = globalThis as unknown as {
  supabase: ReturnType<typeof createClient> | undefined;
};

export const supabase =
  globalForSupabase.supabase ??
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storageKey: 'sb-kvrnomajvqnatczjyzvr-auth-token',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });

if (typeof window !== 'undefined') {
  globalForSupabase.supabase = supabase;
}
