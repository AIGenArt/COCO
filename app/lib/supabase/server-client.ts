import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false
      }
    });
  }
  return supabaseClient;
}
