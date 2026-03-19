import { getSupabaseServiceClient } from "../supabase/server-client";

export type GitHubInstallation = {
  id: string;
  user_id: string;
  github_installation_id: string;
  account_login: string;
  access_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function createGitHubInstallation(input: {
  userId: string;
  githubInstallationId: number;
  accountLogin: string;
  accessType: string;
  isActive?: boolean;
}) {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("github_installations")
    .insert([
      {
        user_id: input.userId,
        github_installation_id: input.githubInstallationId,
        account_login: input.accountLogin,
        access_type: input.accessType,
        is_active: input.isActive ?? true
      }
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as GitHubInstallation;
}

export async function getGitHubInstallationsByUser(userId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("github_installations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data as GitHubInstallation[];
}

export async function getActiveGitHubInstallationByUser(userId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("github_installations")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is returned when no rows are found for single() in Supabase.
    throw error;
  }

  return (data as GitHubInstallation) ?? null;
}

export async function findGitHubInstallationByGitHubId(githubInstallationId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("github_installations")
    .select("*")
    .eq("github_installation_id", githubInstallationId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return (data as GitHubInstallation) ?? null;
}

export async function markGitHubInstallationInactive(installationId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("github_installations")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", installationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as GitHubInstallation;
}

export async function markGitHubInstallationActive(installationId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("github_installations")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", installationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as GitHubInstallation;
}
