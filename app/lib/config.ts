import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_APP_WEBHOOK_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  RUNTIME_SERVICE_URL: z.string().url(),
  RUNTIME_SERVICE_SECRET: z.string().min(1),
  MAX_WORKSPACES_PER_USER: z.preprocess((val) => Number(val), z.number().int().positive()).default(3),
  WORKSPACE_IDLE_TIMEOUT_MS: z.preprocess((val) => Number(val), z.number().int().positive()).default(1000 * 60 * 60),
  PREVIEW_PROXY_TIMEOUT_MS: z.preprocess((val) => Number(val), z.number().int().positive()).default(15_000),
  WORKSPACE_MAX_FILE_SIZE_BYTES: z.preprocess((val) => Number(val), z.number().int().positive()).default(5_000_000),
  WORKSPACE_MAX_TOTAL_FILES: z.preprocess((val) => Number(val), z.number().int().positive()).default(3000),
  WORKSPACE_MAX_TOTAL_BYTES: z.preprocess((val) => Number(val), z.number().int().positive()).default(200_000_000)
});

type AppConfig = z.infer<typeof envSchema>;

let parsedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!parsedConfig) {
    parsedConfig = envSchema.parse(process.env);
  }
  return parsedConfig;
}

export const config = new Proxy({} as AppConfig, {
  get(_target, property: keyof AppConfig) {
    return getConfig()[property];
  }
});
