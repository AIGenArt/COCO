import { z } from "zod";

const toNumber = (defaultValue: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return defaultValue;
    }

    return Number(value);
  }, z.number().int().positive());

const sharedConfigSchema = z.object({
  MAX_WORKSPACES_PER_USER: toNumber(3),
  WORKSPACE_IDLE_TIMEOUT_MS: toNumber(1000 * 60 * 60),
  PREVIEW_PROXY_TIMEOUT_MS: toNumber(15_000),
  WORKSPACE_MAX_FILE_SIZE_BYTES: toNumber(5_000_000),
  WORKSPACE_MAX_TOTAL_FILES: toNumber(3000),
  WORKSPACE_MAX_TOTAL_BYTES: toNumber(200_000_000)
});

export type SharedConfig = z.infer<typeof sharedConfigSchema>;

let parsedSharedConfig: SharedConfig | null = null;

export function getSharedConfig(): SharedConfig {
  if (!parsedSharedConfig) {
    parsedSharedConfig = sharedConfigSchema.parse({
      MAX_WORKSPACES_PER_USER: process.env.MAX_WORKSPACES_PER_USER,
      WORKSPACE_IDLE_TIMEOUT_MS: process.env.WORKSPACE_IDLE_TIMEOUT_MS,
      PREVIEW_PROXY_TIMEOUT_MS: process.env.PREVIEW_PROXY_TIMEOUT_MS,
      WORKSPACE_MAX_FILE_SIZE_BYTES: process.env.WORKSPACE_MAX_FILE_SIZE_BYTES,
      WORKSPACE_MAX_TOTAL_FILES: process.env.WORKSPACE_MAX_TOTAL_FILES,
      WORKSPACE_MAX_TOTAL_BYTES: process.env.WORKSPACE_MAX_TOTAL_BYTES
    });
  }

  return parsedSharedConfig;
}
