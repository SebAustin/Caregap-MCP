import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Request } from "express";
import { registerAllTools } from "./tools/index.js";

const SERVER_NAME = "CareGap MCP";
const SERVER_VERSION = "0.1.0";

export function createCareGapServer(req: Request): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        logging: {},
        experimental: {
          fhir_context_required: { value: true },
        },
        extensions: {
          "ai.promptopinion/fhir-context": {
            scopes: [
              { name: "patient/Patient.rs", required: true },
              { name: "patient/Observation.rs" },
              { name: "patient/Condition.rs" },
              { name: "patient/Procedure.rs" },
              { name: "patient/Immunization.rs" },
              { name: "patient/MedicationRequest.rs" },
              { name: "patient/DocumentReference.rs" },
              { name: "patient/Coverage.rs" },
              { name: "patient/DiagnosticReport.rs" },
            ],
          },
        },
      },
      instructions:
        "CareGap MCP identifies and closes HEDIS/CMS quality measure gaps. " +
        "Typical workflow: (1) get_measure_specification to understand a measure, " +
        "(2) identify_open_measure_gaps or calculate_measure_eligibility to evaluate a patient, " +
        "(3) assess_measure_exclusions to find exclusions in clinical notes that rules engines miss, " +
        "(4) rank_gaps_by_priority to prioritize which gaps to close first, " +
        "(5) draft_patient_outreach to generate a personalized closure message. " +
        "Use panel_gap_summary for a program-level view across all patients. " +
        "In fixture mode, use patient IDs: patient-maria-001, patient-james-002, patient-lin-003, patient-alex-004.",
    },
  );

  registerAllTools(server, req);

  return server;
}
