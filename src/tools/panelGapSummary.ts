import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Request } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getFhirContext } from "../middleware/sharpContext.js";
import { evaluateGaps } from "../measures/engine.js";
import "../measures/evaluators/index.js";
import { getMeasureSpec, getAllMeasureIds } from "../measures/registry.js";
import { getFixturePatientIds } from "../fixtures/loader.js";

export function registerPanelGapSummaryTool(
  server: McpServer,
  req: Request,
): void {
  server.registerTool(
    "panel_gap_summary",
    {
      title: "Panel Gap Summary",
      description:
        "Panel-level rollup: counts how many patients have open gaps per measure, sorted by " +
        "financial impact (MIPS weight x patient count). This is the 'program director' view — " +
        "shows where to focus quality improvement efforts across an entire patient panel. " +
        "In fixture mode, evaluates all 4 synthetic patients.",
      inputSchema: {
        practitionerId: z
          .string()
          .optional()
          .describe("Practitioner ID to filter panel (not used in fixture mode)"),
        organizationId: z
          .string()
          .optional()
          .describe("Organization ID to filter panel (not used in fixture mode)"),
        measureIds: z
          .array(z.string())
          .optional()
          .describe("Specific measures to summarize. Omit for all."),
        asOfDate: z
          .string()
          .optional()
          .describe("Evaluation date (YYYY-MM-DD). Defaults to today."),
      },
      annotations: {
        title: "Panel Gap Summary",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({
      measureIds,
      asOfDate,
    }): Promise<CallToolResult> => {
      const fhirCtx = getFhirContext(req);
      const targetMeasures = measureIds ?? getAllMeasureIds();
      const asOf = asOfDate ?? new Date().toISOString().slice(0, 10);

      // In fixture mode, iterate all fixture patients
      // In fhir mode, this would query for a practitioner/org panel — stubbed for now
      let patientIds: string[];
      if (config.MCP_MODE === "fixture") {
        patientIds = getFixturePatientIds();
      } else {
        // TODO: In fhir mode, query patients by practitioner/organization
        return {
          content: [
            {
              type: "text",
              text: "Panel gap summary in FHIR mode requires practitioner or organization-based patient queries, which are not yet implemented. Use fixture mode for demo.",
            },
          ],
          isError: true,
        };
      }

      const measureSummary = new Map<
        string,
        {
          measureId: string;
          measureName: string;
          mipsWeight: number;
          open: number;
          closed: number;
          excluded: number;
          notEligible: number;
          total: number;
          openPatients: string[];
        }
      >();

      for (const mid of targetMeasures) {
        const spec = getMeasureSpec(mid);
        if (!spec) continue;
        measureSummary.set(mid, {
          measureId: mid,
          measureName: spec.name,
          mipsWeight: spec.mipsWeight ?? 0,
          open: 0,
          closed: 0,
          excluded: 0,
          notEligible: 0,
          total: 0,
          openPatients: [],
        });
      }

      for (const pid of patientIds) {
        const result = await evaluateGaps(pid, fhirCtx, targetMeasures, asOf);
        for (const gap of result.gaps) {
          const entry = measureSummary.get(gap.measureId);
          if (!entry) continue;
          entry.total++;
          switch (gap.status) {
            case "open":
              entry.open++;
              entry.openPatients.push(pid);
              break;
            case "closed":
              entry.closed++;
              break;
            case "excluded":
              entry.excluded++;
              break;
            case "not_eligible":
              entry.notEligible++;
              break;
          }
        }
      }

      const sorted = Array.from(measureSummary.values()).sort(
        (a, b) => b.mipsWeight * b.open - a.mipsWeight * a.open,
      );

      const output = {
        asOfDate: asOf,
        panelSize: patientIds.length,
        measures: sorted.map((m) => ({
          measureId: m.measureId,
          measureName: m.measureName,
          mipsWeight: m.mipsWeight,
          openGaps: m.open,
          closedGaps: m.closed,
          excluded: m.excluded,
          notEligible: m.notEligible,
          totalEvaluated: m.total,
          gapRate:
            m.total - m.notEligible > 0
              ? Math.round(
                  (m.open / (m.total - m.notEligible)) * 100,
                )
              : 0,
          financialImpactScore: m.mipsWeight * m.open,
          openPatientIds: m.openPatients,
        })),
      };

      const table = sorted
        .map(
          (m) =>
            `${m.measureId.padEnd(8)} ${m.measureName.padEnd(45)} ` +
            `Open: ${m.open}  Closed: ${m.closed}  Excl: ${m.excluded}  N/A: ${m.notEligible}  ` +
            `MIPS×Open: ${m.mipsWeight * m.open}`,
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text:
              `Panel Gap Summary (${patientIds.length} patients, as of ${asOf}):\n\n` +
              table +
              `\n\n--- Structured Result ---\n${JSON.stringify(output, null, 2)}`,
          },
        ],
      };
    },
  );
}
