import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Request } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getFhirContext } from "../middleware/sharpContext.js";
import { evaluateGaps } from "../measures/engine.js";
import "../measures/evaluators/index.js";
import { getFixturePatientIds } from "../fixtures/loader.js";

export function registerIdentifyOpenGapsTool(
  server: McpServer,
  req: Request,
): void {
  server.registerTool(
    "identify_open_measure_gaps",
    {
      title: "Identify Open Measure Gaps",
      description:
        "Enumerate HEDIS/CMS quality measure gaps for a patient. Evaluates the patient's FHIR " +
        "record against each measure's denominator, numerator, and exclusion criteria. Returns a " +
        "structured list of gaps with status (open/closed/excluded/not_eligible), evidence citations, " +
        "and confidence scores. In fixture mode, use patient IDs: " +
        getFixturePatientIds().join(", "),
      inputSchema: {
        patientId: z
          .string()
          .optional()
          .describe(
            "Patient ID. Optional if X-Patient-ID header is set.",
          ),
        measureIds: z
          .array(z.string())
          .optional()
          .describe(
            "Specific measure IDs to evaluate (e.g. ['BCS-E','HBD']). Omit to evaluate all.",
          ),
        asOfDate: z
          .string()
          .optional()
          .describe(
            "Evaluation date in ISO format (YYYY-MM-DD). Defaults to today.",
          ),
      },
      annotations: {
        title: "Identify Open Measure Gaps",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ patientId, measureIds, asOfDate }): Promise<CallToolResult> => {
      const fhirCtx = getFhirContext(req);
      const resolvedPatientId =
        patientId ?? fhirCtx?.patientId;

      if (!resolvedPatientId) {
        return {
          content: [
            {
              type: "text",
              text: "Patient ID is required. Provide it as a parameter or via X-Patient-ID header.",
            },
          ],
          isError: true,
        };
      }

      const result = await evaluateGaps(
        resolvedPatientId,
        fhirCtx,
        measureIds,
        asOfDate,
      );

      const summary = result.gaps
        .map(
          (g) =>
            `${g.measureId} (${g.measureName}): ${g.status.toUpperCase()}` +
            (g.dueDate ? ` — due ${g.dueDate}` : "") +
            (g.evidence.length > 0
              ? ` [${g.evidence.map((e) => `${e.field}: ${e.value}`).join("; ")}]`
              : ""),
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text:
              `Gap analysis for patient ${result.patientId} as of ${result.asOfDate}:\n\n` +
              (result.gaps.length > 0 ? summary : "No applicable measures found for this patient.") +
              `\n\n--- Structured Result ---\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    },
  );
}
