import "server-only";
import { z } from "zod";

const supabaseServerSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1)
});

const githubServerSchema = z.object({
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_APP_WEBHOOK_SECRET: z.string().min(1)
});

const authServerSchema = z.object({
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32)
});

const runtimeServerSchema = z.object({
  RUNTIME_SERVICE_URL: z.string().url(),
  RUNTIME_SERVICE_SECRET: z.string().min(32)
});

export type SupabaseServerConfig = z.infer<typeof supabaseServerSchema>;
export type GitHubServerConfig = z.infer<typeof githubServerSchema>;
export type AuthServerConfig = z.infer<typeof authServerSchema>;
export type RuntimeServerConfig = z.infer<typeof runtimeServerSchema>;

let supabaseServerConfig: SupabaseServerConfig | null = null;
let githubServerConfig: GitHubServerConfig | null = null;
let authServerConfig: AuthServerConfig | null = null;
let runtimeServerConfig: RuntimeServerConfig | null = null;

export function getSupabaseServerConfig(): SupabaseServerConfig {
  if (!supabaseServerConfig) {
    supabaseServerConfig = supabaseServerSchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
    });
  }

  return supabaseServerConfig;
}

export function getGitHubServerConfig(): GitHubServerConfig {
  if (!githubServerConfig) {
    githubServerConfig = githubServerSchema.parse({
      GITHUB_APP_ID: process.env.GITHUB_APP_ID,
      GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
      GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
      GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
      GITHUB_APP_WEBHOOK_SECRET: process.env.GITHUB_APP_WEBHOOK_SECRET
    });
  }

  return githubServerConfig;
}

export function getAuthServerConfig(): AuthServerConfig {
  if (!authServerConfig) {
    authServerConfig = authServerSchema.parse({
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET
    });
  }

  return authServerConfig;
}

export function getRuntimeServerConfig(): RuntimeServerConfig {
  if (!runtimeServerConfig) {
    runtimeServerConfig = runtimeServerSchema.parse({
      RUNTIME_SERVICE_URL: process.env.RUNTIME_SERVICE_URL,
      RUNTIME_SERVICE_SECRET: process.env.RUNTIME_SERVICE_SECRET
    });
  }

  return runtimeServerConfig;
}
