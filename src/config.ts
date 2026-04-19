import { z } from "zod";
import "dotenv/config";

const ConfigSchema = z.object({
  MCP_MODE: z.enum(["fhir", "fixture"]).default("fhir"),
  PORT: z.coerce.number().int().min(0).default(3333),
  MCP_API_KEYS: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("claude-sonnet-4-5"),
  LLM_MAX_TOKENS: z.coerce.number().int().positive().default(2048),
  DRY_RUN: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  MCP_ALLOW_PRIVATE_FHIR: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${formatted}`);
  }
  return result.data;
}

export const config = loadConfig();

export function getApiKeys(): string[] {
  if (!config.MCP_API_KEYS) return [];
  return config.MCP_API_KEYS.split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}
