import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Request } from "express";
import { z } from "zod";
import { getFhirContext } from "../middleware/sharpContext.js";
import { loadPatientContext, patientAge } from "../measures/engine.js";
import { getMeasureSpec } from "../measures/registry.js";
import { reason } from "../llm/anthropic.js";
import {
  EXCLUSION_SYSTEM_V1,
  buildExclusionPrompt,
} from "../llm/prompts.js";
import { redact } from "../util/redact.js";

export function registerAssessExclusionsTool(
  server: McpServer,
  req: Request,
): void {
  server.registerTool(
    "assess_measure_exclusions",
    {
      title: "Assess Measure Exclusions",
      description:
        "Uses AI to analyze a patient's clinical documentation (notes, conditions, observations) " +
        "to identify valid HEDIS/CMS measure exclusions that a rules engine might miss. " +
        "This catches exclusions buried in unstructured text — hospice enrollment notes, outside-facility " +
        "screening results, bilateral mastectomy documentation, patient refusals, and contraindications. " +
        "Returns structured exclusion findings with evidence citations and confidence scores.",
      inputSchema: {
        patientId: z.string().describe("Patient ID to evaluate"),
        measureId: z
          .string()
          .describe("Measure ID to check exclusions for (e.g. BCS-E, COL-E)"),
      },
      annotations: {
        title: "Assess Measure Exclusions",
        readOnlyHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ patientId, measureId }): Promise<CallToolResult> => {
      const fhirCtx = getFhirContext(req);
      const spec = getMeasureSpec(measureId);

      if (!spec) {
        return {
          content: [{ type: "text", text: `Unknown measure ID: "${measureId}"` }],
          isError: true,
        };
      }

      const ctx = await loadPatientContext(patientId, fhirCtx);
      if (!ctx) {
        return {
          content: [{ type: "text", text: `Patient "${patientId}" not found.` }],
          isError: true,
        };
      }

      const age = patientAge(ctx.patient, new Date());
      const patientSummary = buildPatientSummary(ctx, age);
      const clinicalDocs = buildClinicalDocContext(ctx);

      const prompt = buildExclusionPrompt(
        spec.id,
        spec.name,
        spec.exclusionCriteria,
        redact(patientSummary),
        redact(clinicalDocs),
      );

      const llmResult = await reason(prompt, EXCLUSION_SYSTEM_V1);

      let parsed: { exclusions: ExclusionFinding[] };
      try {
        parsed = JSON.parse(llmResult.text) as { exclusions: ExclusionFinding[] };
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
        measureId: spec.id,
        measureName: spec.name,
        patientId,
        exclusions: parsed.exclusions,
        llmModel: llmResult.model,
        tokensUsed: {
          input: llmResult.inputTokens,
          output: llmResult.outputTokens,
        },
      };

      const summary =
        parsed.exclusions.length === 0
          ? `No exclusions identified for ${spec.name}.`
          : parsed.exclusions
              .map(
                (e, i) =>
                  `${i + 1}. ${e.reason} (confidence: ${e.llmConfidence})\n` +
                  e.evidence
                    .map(
                      (ev) =>
                        `   - ${ev.resourceType}/${ev.resourceId}: "${ev.snippet}"`,
                    )
                    .join("\n"),
              )
              .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text:
              `Exclusion analysis for ${spec.name} (${spec.id}), patient ${patientId}:\n\n` +
              summary +
              `\n\n--- Structured Result ---\n${JSON.stringify(output, null, 2)}`,
          },
        ],
      };
    },
  );
}

interface ExclusionFinding {
  reason: string;
  hedisExclusionCode?: string;
  evidence: Array<{
    resourceType: string;
    resourceId: string;
    snippet: string;
  }>;
  llmConfidence: number;
}

function buildPatientSummary(
  ctx: import("../measures/engine.js").PatientContext,
  age: number | null,
): string {
  const p = ctx.patient;
  const lines: string[] = [
    `Age: ${age ?? "unknown"}, Gender: ${p.gender ?? "unknown"}`,
  ];

  if (ctx.conditions.length > 0) {
    lines.push(
      `Active conditions: ${ctx.conditions.map((c) => c.code?.text ?? c.code?.coding?.[0]?.display ?? "unknown").join(", ")}`,
    );
  }

  return lines.join("\n");
}

function buildClinicalDocContext(
  ctx: import("../measures/engine.js").PatientContext,
): string {
  const docs: string[] = [];

  for (const doc of ctx.documentReferences) {
    const attachments = doc.content ?? [];
    for (const att of attachments) {
      if (att.attachment?.data) {
        try {
          const decoded = Buffer.from(att.attachment.data, "base64").toString(
            "utf-8",
          );
          docs.push(
            `[DocumentReference/${doc.id ?? "unknown"}, date: ${doc.date ?? "unknown"}]\n${decoded}`,
          );
        } catch {
          docs.push(
            `[DocumentReference/${doc.id ?? "unknown"}] (unable to decode attachment)`,
          );
        }
      }
    }
  }

  for (const cond of ctx.conditions) {
    docs.push(
      `[Condition/${cond.id ?? "unknown"}, status: ${cond.clinicalStatus?.coding?.[0]?.code ?? "unknown"}] ` +
        `${cond.code?.text ?? cond.code?.coding?.[0]?.display ?? "unknown condition"}` +
        (cond.onsetDateTime ? ` (onset: ${cond.onsetDateTime})` : ""),
    );
  }

  if (docs.length === 0) {
    return "No clinical documentation available.";
  }

  return docs.join("\n\n");
}
