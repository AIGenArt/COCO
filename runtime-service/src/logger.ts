import pino from "pino";
import { config } from "./config";

export function createLogger() {
  return pino({
    level: config.LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: undefined,
    formatters: {
      level: (label) => ({ level: label })
    }
  });
}
