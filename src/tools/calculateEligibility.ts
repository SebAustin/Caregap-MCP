import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Request } from "express";
import { z } from "zod";
import { getFhirContext } from "../middleware/sharpContext.js";
import {
  loadPatientContext,
  patientAge,
  hasConditionCode,
  hasActiveCoverage,
} from "../measures/engine.js";
import "../measures/evaluators/index.js";
import { getMeasureSpec } from "../measures/registry.js";
import { MEASURE_SNOMED } from "../fhir/queries.js";

export function registerCalculateEligibilityTool(
  server: McpServer,
  req: Request,
): void {
  server.registerTool(
    "calculate_measure_eligibility",
    {
      title: "Calculate Measure Eligibility",
      description:
        "Evaluate whether a patient meets the denominator eligibility criteria for a specific " +
        "quality measure. Checks age, sex, continuous enrollment (FHIR Coverage), and " +
        "measure-specific conditions (e.g., hypertension for CBP, diabetes for HBD). " +
        "Returns a detailed breakdown of each criterion.",
      inputSchema: {
        patientId: z
          .string()
          .describe("Patient ID to evaluate"),
        measureId: z
          .string()
          .describe("Measure ID (e.g. BCS-E, CBP, HBD)"),
        asOfDate: z
          .string()
          .optional()
          .describe("Evaluation date (YYYY-MM-DD). Defaults to today."),
      },
      annotations: {
        title: "Calculate Measure Eligibility",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ patientId, measureId, asOfDate }): Promise<CallToolResult> => {
      const fhirCtx = getFhirContext(req);
      const spec = getMeasureSpec(measureId);

      if (!spec) {
        return {
          content: [{ type: "text", text: `Unknown measure ID: "${measureId}"` }],
          isError: true,
        };
      }

      const asOf = asOfDate ? new Date(asOfDate) : new Date();
      const ctx = await loadPatientContext(patientId, fhirCtx);

      if (!ctx) {
        return {
          content: [{ type: "text", text: `Patient "${patientId}" not found.` }],
          isError: true,
        };
      }

      const criteria: Array<{ criterion: string; met: boolean; detail: string }> = [];
      let eligible = true;

      // Age check
      const age = patientAge(ctx.patient, asOf);
      if (spec.ageRange && age !== null) {
        const ageMet = age >= spec.ageRange.min && age <= spec.ageRange.max;
        criteria.push({
          criterion: `Age ${spec.ageRange.min}–${spec.ageRange.max}`,
          met: ageMet,
          detail: `Patient age: ${age}`,
        });
        if (!ageMet) eligible = false;
      }

      // Gender check
      if (spec.gender && spec.gender !== "any") {
        const genderMet = ctx.patient.gender === spec.gender;
        criteria.push({
          criterion: `Gender: ${spec.gender}`,
          met: genderMet,
          detail: `Patient gender: ${ctx.patient.gender ?? "unknown"}`,
        });
        if (!genderMet) eligible = false;
      }

      // Coverage check
      const coverageMet = hasActiveCoverage(ctx.coverages, asOf);
      criteria.push({
        criterion: "Active coverage during measurement period",
        met: coverageMet,
        detail: coverageMet
          ? `${ctx.coverages.length} coverage record(s) found`
          : "No active coverage found",
      });
      if (!coverageMet) eligible = false;

      // Measure-specific condition checks
      if (measureId === "CBP") {
        const hasHTN = hasConditionCode(ctx.conditions, "http://snomed.info/sct", MEASURE_SNOMED.HYPERTENSION);
        criteria.push({
          criterion: "Hypertension diagnosis",
          met: hasHTN,
          detail: hasHTN ? "Hypertension confirmed" : "No hypertension diagnosis found",
        });
        if (!hasHTN) eligible = false;
      }

      if (measureId === "HBD") {
        const hasDM =
          hasConditionCode(ctx.conditions, "http://snomed.info/sct", MEASURE_SNOMED.DIABETES_TYPE2) ||
          hasConditionCode(ctx.conditions, "http://snomed.info/sct", "46635009");
        criteria.push({
          criterion: "Diabetes diagnosis",
          met: hasDM,
          detail: hasDM ? "Diabetes confirmed" : "No diabetes diagnosis found",
        });
        if (!hasDM) eligible = false;
      }

      const result = {
        patientId,
        measureId,
        measureName: spec.name,
        asOfDate: asOf.toISOString().slice(0, 10),
        eligible,
        criteria,
      };

      const summary = criteria
        .map((c) => `${c.met ? "✓" : "✗"} ${c.criterion}: ${c.detail}`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text:
              `Eligibility for ${spec.name} (${measureId}):\n` +
              `Patient: ${patientId}\n` +
              `Result: ${eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}\n\n` +
              summary +
              `\n\n--- Structured Result ---\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    },
  );
}
