import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { logger } from "../util/logger.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!config.ANTHROPIC_API_KEY && !config.DRY_RUN) {
      throw new Error(
        "ANTHROPIC_API_KEY is required when DRY_RUN is not enabled",
      );
    }
    client = new Anthropic({
      apiKey: config.ANTHROPIC_API_KEY ?? "dry-run-no-key",
    });
  }
  return client;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface ReasonResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Single entry point for all LLM inference.
 * When DRY_RUN=true, returns a deterministic fixture response.
 */
export async function reason(
  prompt: string,
  system: string,
  options?: { maxTokens?: number },
): Promise<ReasonResult> {
  if (config.DRY_RUN) {
    return dryRunResponse(prompt, system);
  }

  const maxTokens = options?.maxTokens ?? config.LLM_MAX_TOKENS;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      logger.debug(
        `LLM request (attempt ${attempt + 1}/${MAX_RETRIES}, model: ${config.LLM_MODEL})`,
      );

      const response = await getClient().messages.create({
        model: config.LLM_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      const rawText = textBlock && "text" in textBlock ? textBlock.text : "";
      const text = stripMarkdownFences(rawText);

      return {
        text,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: response.model,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(
        `LLM request failed (attempt ${attempt + 1}): ${lastError.message}`,
      );

      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error("LLM request failed after retries");
}

function dryRunResponse(prompt: string, _system: string): ReasonResult {
  const lower = prompt.toLowerCase();

  if (lower.includes("exclusion")) {
    return {
      text: JSON.stringify({
        exclusions: [
          {
            reason: "DRY_RUN: Simulated exclusion finding",
            hedisExclusionCode: "DRY-RUN-001",
            evidence: [
              {
                resourceType: "DocumentReference",
                resourceId: "dry-run-doc-001",
                snippet:
                  "Patient reported completing screening at outside facility (simulated DRY_RUN response)",
              },
            ],
            llmConfidence: 0.75,
          },
        ],
      }),
      inputTokens: 0,
      outputTokens: 0,
      model: "dry-run",
    };
  }

  // Rank/priority must be checked BEFORE outreach (ranking prompt contains "outreach" in context)
  if (lower.includes("rank") && lower.includes("gaps by priority")) {
    return {
      text: JSON.stringify({
        rankedGaps: [
          {
            measureId: "DRY-RUN",
            rank: 1,
            rationale: "DRY_RUN: Simulated priority ranking",
            clinicalUrgency: "medium",
          },
        ],
      }),
      inputTokens: 0,
      outputTokens: 0,
      model: "dry-run",
    };
  }

  if (lower.includes("outreach") || lower.includes("draft")) {
    return {
      text: JSON.stringify({
        subject: "Time for your health check-up",
        body: "Dear Patient, this is a DRY_RUN simulated outreach message. Please schedule your appointment for the recommended screening. Your health matters to us. Call us at your convenience.",
        characterCount: 195,
        readingLevelEstimate: "grade6",
      }),
      inputTokens: 0,
      outputTokens: 0,
      model: "dry-run",
    };
  }

  return {
    text: "DRY_RUN: No specific response template matched.",
    inputTokens: 0,
    outputTokens: 0,
    model: "dry-run",
  };
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const lines = trimmed.split("\n");
    lines.shift();
    if (lines.length > 0 && lines[lines.length - 1]!.trim() === "```") {
      lines.pop();
    }
    return lines.join("\n").trim();
  }
  return trimmed;
}
