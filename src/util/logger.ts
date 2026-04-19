import pino from "pino";
import { config } from "../config.js";
import { redact } from "./redact.js";

export const logger = pino({
  level: config.LOG_LEVEL,
  formatters: {
    log(obj: Record<string, unknown>) {
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        cleaned[key] = typeof value === "string" ? redact(value) : value;
      }
      return cleaned;
    },
  },
});
