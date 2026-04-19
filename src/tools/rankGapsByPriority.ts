import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Request } from "express";
import { z } from "zod";
import { getFhirContext } from "../middleware/sharpContext.js";
import { evaluateGaps, loadPatientContext, patientAge } from "../measures/engine.js";
import "../measures/evaluators/index.js";
import { reason } from "../llm/anthropic.js";
import { RANKING_SYSTEM_V1, buildRankingPrompt } from "../llm/prompts.js";
import { redact } from "../util/redact.js";

export function registerRankGapsByPriorityTool(
  server: McpServer,
  req: Request,
): void {
  server.registerTool(
    "rank_gaps_by_priority",
    {
      title: "Rank Gaps by Priority",
      description:
        "Uses AI to rank a patient's open quality measure gaps by clinical urgency, time-to-close, " +
        "patient engagement likelihood, and financial impact (MIPS weight). If no gaps are provided, " +
        "runs identify_open_measure_gaps first. Returns a ranked list with rationale per item.",
      inputSchema: {
        patientId: z.string().describe("Patient ID"),
        gaps: z
          .array(
            z.object({
              measureId: z.string(),
              measureName: z.string(),
              status: z.string(),
              dueDate: z.string().optional(),
            }),
          )
          .optional()
          .describe(
            "Pre-computed gap list. If omitted, identify_open_measure_gaps runs first.",
          ),
      },
      annotations: {
        title: "Rank Gaps by Priority",
        readOnlyHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ patientId, gaps }): Promise<CallToolResult> => {
      const fhirCtx = getFhirContext(req);

      let gapList = gaps;
      if (!gapList || gapList.length === 0) {
        const result = await evaluateGaps(patientId, fhirCtx);
        gapList = result.gaps
          .filter((g) => g.status === "open")
          .map((g) => ({
            measureId: g.measureId,
            measureName: g.measureName,
            status: g.status,
            dueDate: g.dueDate,
          }));
      }

      if (gapList.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No open gaps found for patient ${patientId}. Nothing to rank.`,
            },
          ],
        };
      }

      const ctx = await loadPatientContext(patientId, fhirCtx);
      const age = ctx ? patientAge(ctx.patient, new Date()) : null;
      const patientContext = redact(
        ctx
          ? [
              `Age: ${age ?? "unknown"}, Gender: ${ctx.patient.gender ?? "unknown"}`,
              ctx.conditions.length > 0
                ? `Conditions: ${ctx.conditions.map((c) => c.code?.text ?? c.code?.coding?.[0]?.display ?? "").filter(Boolean).join(", ")}`
                : null,
            ]
              .filter(Boolean)
              .join("\n")
          : "Patient context unavailable",
      );

      const prompt = buildRankingPrompt(
        JSON.stringify(gapList, null, 2),
        patientContext,
      );

      const llmResult = await reason(prompt, RANKING_SYSTEM_V1);

      let parsed: { rankedGaps: RankedGap[] };
      try {
        parsed = JSON.parse(llmResult.text) as { rankedGaps: RankedGap[] };
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `LLM returned non-JSON response. Raw output:\n${llmResult.text}`,
            },
          ],
          isError: true,
        };
      }

      const output = {
        patientId,
        rankedGaps: parsed.rankedGaps,
        llmModel: llmResult.model,
      };

      const summary = parsed.rankedGaps
        .map(
          (g) =>
            `#${g.rank} ${g.measureId}${g.measureName ? ` (${g.measureName})` : ""} ` +
            `[${g.clinicalUrgency ?? "?"} urgency] — ${g.rationale}`,
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text:
              `Priority ranking for patient ${patientId}:\n\n` +
              summary +
              `\n\n--- Structured Result ---\n${JSON.stringify(output, null, 2)}`,
          },
        ],
      };
    },
  );
}

interface RankedGap {
  measureId: string;
  measureName?: string;
  rank: number;
  rationale: string;
  clinicalUrgency?: string;
  timeToClose?: string;
  engagementLikelihood?: string;
}
