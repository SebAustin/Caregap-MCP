import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  getMeasureSpec,
  getAllMeasureIds,
  type MeasureSpec,
} from "../measures/registry.js";

export function registerGetMeasureSpecTool(server: McpServer): void {
  server.registerTool(
    "get_measure_specification",
    {
      title: "Get Measure Specification",
      description:
        "Returns the full HEDIS/CMS quality measure specification for a given measure ID. " +
        "Includes denominator criteria, numerator criteria, exclusions, relevant value sets (with OIDs), " +
        "and measurement period definition. Use this to understand what a measure requires before " +
        "evaluating patient gaps. Available measures: " +
        getAllMeasureIds().join(", "),
      inputSchema: {
        measureId: z
          .string()
          .describe(
            "The measure identifier (e.g. BCS-E, COL-E, CBP, HBD, IMA)",
          ),
      },
      annotations: {
        title: "Get Measure Specification",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ measureId }): Promise<CallToolResult> => {
      const spec = getMeasureSpec(measureId);
      if (!spec) {
        const available = getAllMeasureIds().join(", ");
        return {
          content: [
            {
              type: "text",
              text: `Unknown measure ID: "${measureId}". Available measures: ${available}`,
            },
          ],
          isError: true,
        };
      }

      const output = formatSpec(spec);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    },
  );
}

function formatSpec(spec: MeasureSpec) {
  return {
    measureId: spec.id,
    name: spec.name,
    shortName: spec.shortName,
    version: spec.version,
    steward: spec.steward,
    description: spec.description,
    clinicalDomain: spec.clinicalDomain,
    eligibility: {
      ageRange: spec.ageRange ?? null,
      gender: spec.gender ?? "any",
    },
    measurementPeriod: spec.measurementPeriod,
    denominator: spec.denominatorCriteria,
    numerator: spec.numeratorCriteria,
    exclusions: spec.exclusionCriteria,
    valueSets: spec.valueSets,
    mipsWeight: spec.mipsWeight ?? null,
  };
}
