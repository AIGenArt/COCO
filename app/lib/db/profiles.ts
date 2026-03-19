import { getSupabaseServiceClient } from "../supabase/server-client";

export type ProfileRow = {
  id: string;
  github_id: string;
  github_login: string;
  github_avatar_url?: string | null;
  tier: "free" | "pro" | "enterprise";
  created_at: string;
};

export async function ensureProfile(userId: string, githubId: string, githubLogin: string, githubAvatarUrl?: string | null) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        github_id: githubId,
        github_login: githubLogin,
        github_avatar_url: githubAvatarUrl,
        tier: "free"
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  const profile = data as ProfileRow | null;

  if (error) {
    throw error;
  }

  return profile;
}

export async function getProfile(userId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data as ProfileRow | null;
}
