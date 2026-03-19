import { getSupabaseServiceClient } from "../supabase/server-client";

export type GitHubRepoAccess = {
  id: string;
  installation_id: string;
  owner: string;
  repo: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listActiveReposForInstallation(installationId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("github_repo_access")
    .select("*")
    .eq("installation_id", installationId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    throw error;
  }

  return data as GitHubRepoAccess[];
}

export async function upsertRepoAccessRecords(
  installationId: string,
  repos: Array<{ owner: string; repo: string; full_name: string }>
) {
  if (repos.length === 0) {
    return [] as GitHubRepoAccess[];
  }

  const supabase = getSupabaseServiceClient();

  const rows = repos.map((r) => ({
    installation_id: installationId,
    owner: r.owner,
    repo: r.repo,
    full_name: r.full_name,
    is_active: true
  }));

  const { data, error } = await supabase
    .from("github_repo_access")
    .upsert(rows, { onConflict: "installation_id,owner,repo" })
    .select();

  if (error) {
    throw error;
  }

  return data as GitHubRepoAccess[];
}

export async function markRepoAccessInactive(
  installationId: string,
  repos: Array<{ owner: string; repo: string }>
) {
  if (repos.length === 0) {
    return [] as GitHubRepoAccess[];
  }

  const supabase = getSupabaseServiceClient();

  const updates = await Promise.all(
    repos.map(async (r) => {
      const { data, error } = await supabase
        .from("github_repo_access")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .match({ installation_id: installationId, owner: r.owner, repo: r.repo })
        .select()
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return (data as GitHubRepoAccess) ?? null;
    })
  );

  return updates.filter(Boolean) as GitHubRepoAccess[];
}
