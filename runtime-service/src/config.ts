import { z } from "zod";

const envSchema = z.object({
  RUNTIME_SERVICE_PORT: z.preprocess((v) => Number(v), z.number().int().positive()).default(4001),
  RUNTIME_SERVICE_SECRET: z.string().min(1),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export const config = envSchema.parse(process.env);
