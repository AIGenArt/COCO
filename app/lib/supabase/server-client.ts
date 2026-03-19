import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getPublicConfig } from "../config/public";
import { getSupabaseServerConfig } from "../config/server";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
  const publicConfig = getPublicConfig();
  const serverConfig = getSupabaseServerConfig();

  if (!supabaseClient) {
    supabaseClient = createClient(publicConfig.NEXT_PUBLIC_SUPABASE_URL, serverConfig.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false
      }
    });
  }

  return supabaseClient;
}
