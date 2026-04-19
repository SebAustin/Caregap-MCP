import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Request } from "express";
import { z } from "zod";
import { getFhirContext } from "../middleware/sharpContext.js";
import { loadPatientContext, patientAge } from "../measures/engine.js";
import { getMeasureSpec, getAllMeasureIds } from "../measures/registry.js";
import { reason } from "../llm/anthropic.js";
import { OUTREACH_SYSTEM_V1, buildOutreachPrompt } from "../llm/prompts.js";
import { redact } from "../util/redact.js";

export function registerDraftOutreachTool(
  server: McpServer,
  req: Request,
): void {
  server.registerTool(
    "draft_patient_outreach",
    {
      title: "Draft Patient Outreach",
      description:
        "Generate a personalized, literacy-appropriate, culturally-aware outreach message to " +
        "help a patient close quality measure gaps. Supports SMS, email, patient portal, and " +
        "letter channels. Respects character limits, reading level, language preference, and tone. " +
        "The generated message uses placeholders instead of real PHI.",
      inputSchema: {
        patientId: z.string().describe("Patient ID"),
        gapIds: z
          .array(z.string())
          .describe("Measure IDs for the gaps to address (e.g. ['BCS-E', 'HBD'])"),
        channel: z
          .enum(["sms", "email", "portal", "letter"])
          .describe("Communication channel"),
        readingLevel: z
          .enum(["grade4", "grade6", "grade8"])
          .optional()
          .default("grade6")
          .describe("Target reading level"),
        language: z
          .string()
          .optional()
          .default("en")
          .describe("BCP-47 language code (e.g. 'en', 'es', 'tl')"),
        tone: z
          .enum(["warm", "direct", "formal"])
          .optional()
          .default("warm")
          .describe("Message tone"),
      },
      annotations: {
        title: "Draft Patient Outreach",
        readOnlyHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      patientId,
      gapIds,
      channel,
      readingLevel,
      language,
      tone,
    }): Promise<CallToolResult> => {
      const fhirCtx = getFhirContext(req);
      const ctx = await loadPatientContext(patientId, fhirCtx);

      if (!ctx) {
        return {
          content: [{ type: "text", text: `Patient "${patientId}" not found.` }],
          isError: true,
        };
      }

      const gapDescriptions = gapIds
        .map((id) => {
          const spec = getMeasureSpec(id);
          return spec
            ? `- ${spec.name} (${spec.id}): ${spec.description.slice(0, 150)}...`
            : `- Unknown measure: ${id}`;
        })
        .join("\n");

      const age = patientAge(ctx.patient, new Date());
      const preferredLang = ctx.patient.communication
        ?.find((c) => c.preferred)
        ?.language?.coding?.[0]?.code;

      const patientContext = redact(
        [
          `Age: ${age ?? "unknown"}, Gender: ${ctx.patient.gender ?? "unknown"}`,
          preferredLang ? `Preferred language: ${preferredLang}` : null,
          ctx.conditions.length > 0
            ? `Conditions: ${ctx.conditions.map((c) => c.code?.text ?? c.code?.coding?.[0]?.display ?? "").filter(Boolean).join(", ")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );

      const prompt = buildOutreachPrompt(
        gapDescriptions,
        channel,
        readingLevel ?? "grade6",
        language ?? "en",
        tone ?? "warm",
        patientContext,
      );

      const llmResult = await reason(prompt, OUTREACH_SYSTEM_V1);

      let parsed: OutreachResult;
      try {
        parsed = JSON.parse(llmResult.text) as OutreachResult;
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
        subject: parsed.subject ?? null,
        body: parsed.body,
        characterCount: parsed.body.length,
        channel,
        language: language ?? "en",
        readingLevelEstimate: parsed.readingLevelEstimate ?? readingLevel ?? "grade6",
        llmModel: llmResult.model,
      };

      const preview =
        (output.subject ? `Subject: ${output.subject}\n\n` : "") +
        output.body +
        `\n\n[${output.characterCount} chars, ${output.channel}, ${output.language}, ~${output.readingLevelEstimate}]`;

      return {
        content: [
          {
            type: "text",
            text:
              `Outreach draft for patient ${patientId}:\n\n` +
              preview +
              `\n\n--- Structured Result ---\n${JSON.stringify(output, null, 2)}`,
          },
        ],
      };
    },
  );
}

interface OutreachResult {
  subject?: string;
  body: string;
  characterCount?: number;
  readingLevelEstimate?: string;
}
