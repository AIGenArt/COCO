import { z } from "zod";

const publicConfigSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;

let parsedPublicConfig: PublicConfig | null = null;

function readPublicEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };
}

export function hasPublicSupabaseConfig(): boolean {
  const env = readPublicEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getPublicConfig(): PublicConfig {
  if (!parsedPublicConfig) {
    parsedPublicConfig = publicConfigSchema.parse(readPublicEnv());
  }

  return parsedPublicConfig;
}
