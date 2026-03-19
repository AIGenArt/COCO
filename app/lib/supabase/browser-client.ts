import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getPublicConfig, hasPublicSupabaseConfig } from "../config/public";

let supabaseClient: SupabaseClient | null = null;

export function isSupabaseBrowserConfigured(): boolean {
  return hasPublicSupabaseConfig();
}

export function getSupabaseBrowserClient(): SupabaseClient {
  const config = getPublicConfig();

  if (!supabaseClient) {
    supabaseClient = createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true
      }
    });
  }

  return supabaseClient;
}
