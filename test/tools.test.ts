import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

const MCP_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  process.env["MCP_MODE"] = "fixture";
  process.env["PORT"] = "0";
  process.env["MCP_API_KEYS"] = "";
  process.env["LOG_LEVEL"] = "silent";
  process.env["DRY_RUN"] = "true";

  const { createTestApp } = await import("./helpers/createTestApp.js");
  const result = await createTestApp({ mode: "fixture" });
  server = result.server;
  baseUrl = result.baseUrl;
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

function mcpRequest(id: number, method: string, params: unknown) {
  return { jsonrpc: "2.0", id, method, params };
}

async function callTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify(
      mcpRequest(10, "tools/call", { name: toolName, arguments: args }),
    ),
  });
  expect(res.status).toBe(200);
  const text = await res.text();
  return parseResponse(text, 10)!;
}

describe("get_measure_specification tool", () => {
  it("returns BCS-E spec with all required fields", async () => {
    const response = await callTool("get_measure_specification", {
      measureId: "BCS-E",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content).toHaveLength(1);

    const spec = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;
    expect(spec["measureId"]).toBe("BCS-E");
    expect(spec["name"]).toBe("Breast Cancer Screening");
    expect(spec["denominator"]).toBeDefined();
    expect(spec["numerator"]).toBeDefined();
    expect(spec["exclusions"]).toBeDefined();
    expect(spec["valueSets"]).toBeDefined();
    expect(
      (spec["eligibility"] as Record<string, unknown>)["gender"],
    ).toBe("female");
  });

  it("returns error for unknown measure", async () => {
    const response = await callTool("get_measure_specification", {
      measureId: "FAKE-001",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Unknown measure ID");
    expect(result.content[0]!.text).toContain("BCS-E");
  });

  it("tools/list includes all M1–M3 tools", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify(
        mcpRequest(20, "tools/list", {}),
      ),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    const parsed = parseResponse(text, 20);
    const result = parsed!["result"] as {
      tools: Array<{ name: string }>;
    };
    const names = result.tools.map((t) => t.name);
    expect(names).toContain("ping");
    expect(names).toContain("get_measure_specification");
    expect(names).toContain("identify_open_measure_gaps");
    expect(names).toContain("calculate_measure_eligibility");
  });

  it("returns COL-E spec with multiple screening modalities", async () => {
    const response = await callTool("get_measure_specification", {
      measureId: "COL-E",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    const spec = JSON.parse(result.content[0]!.text) as {
      numerator: string[];
    };
    expect(spec.numerator.length).toBeGreaterThanOrEqual(3);
  });

  it("returns HBD spec with diabetes criteria", async () => {
    const response = await callTool("get_measure_specification", {
      measureId: "HBD",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    const spec = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;
    expect(spec["measureId"]).toBe("HBD");
    expect((spec["name"] as string)).toContain("A1c");
  });
});

describe("identify_open_measure_gaps tool", () => {
  it("returns gaps for Maria (multiple open)", async () => {
    const response = await callTool("identify_open_measure_gaps", {
      patientId: "patient-maria-001",
      asOfDate: "2026-04-01",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    const text = result.content[0]!.text;
    expect(text).toContain("BCS-E");
    expect(text).toContain("OPEN");
    expect(text).toContain("Structured Result");
  });

  it("returns error when no patient ID provided", async () => {
    const response = await callTool("identify_open_measure_gaps", {});
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Patient ID is required");
  });

  it("evaluates specific measures only", async () => {
    const response = await callTool("identify_open_measure_gaps", {
      patientId: "patient-maria-001",
      measureIds: ["BCS-E"],
      asOfDate: "2026-04-01",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    const text = result.content[0]!.text;
    expect(text).toContain("BCS-E");
    // Should not contain other measures
    const structured = JSON.parse(
      text.split("--- Structured Result ---\n")[1]!,
    ) as { gaps: Array<{ measureId: string }> };
    expect(structured.gaps).toHaveLength(1);
  });
});

describe("calculate_measure_eligibility tool", () => {
  it("shows Maria eligible for CBP (has hypertension)", async () => {
    const response = await callTool("calculate_measure_eligibility", {
      patientId: "patient-maria-001",
      measureId: "CBP",
      asOfDate: "2026-04-01",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0]!.text).toContain("ELIGIBLE");
    expect(result.content[0]!.text).toContain("Hypertension confirmed");
  });

  it("shows James not eligible for HBD (no diabetes)", async () => {
    const response = await callTool("calculate_measure_eligibility", {
      patientId: "patient-james-002",
      measureId: "HBD",
      asOfDate: "2026-04-01",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0]!.text).toContain("NOT ELIGIBLE");
    expect(result.content[0]!.text).toContain("No diabetes");
  });

  it("returns error for unknown measure", async () => {
    const response = await callTool("calculate_measure_eligibility", {
      patientId: "patient-maria-001",
      measureId: "FAKE",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
      isError: boolean;
    };
    expect(result.isError).toBe(true);
  });
});

describe("assess_measure_exclusions tool (DRY_RUN)", () => {
  it("returns exclusion findings for Maria BCS-E", async () => {
    const response = await callTool("assess_measure_exclusions", {
      patientId: "patient-maria-001",
      measureId: "BCS-E",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    const text = result.content[0]!.text;
    expect(text).toContain("Exclusion analysis");
    expect(text).toContain("BCS-E");
    expect(text).toContain("Structured Result");

    const structured = JSON.parse(
      text.split("--- Structured Result ---\n")[1]!,
    ) as { exclusions: Array<{ reason: string }>; llmModel: string };
    expect(structured.exclusions.length).toBeGreaterThanOrEqual(1);
    expect(structured.llmModel).toBe("dry-run");
  });

  it("returns error for unknown patient", async () => {
    const response = await callTool("assess_measure_exclusions", {
      patientId: "nonexistent",
      measureId: "BCS-E",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("not found");
  });

  it("returns error for unknown measure", async () => {
    const response = await callTool("assess_measure_exclusions", {
      patientId: "patient-maria-001",
      measureId: "NOPE",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
      isError: boolean;
    };
    expect(result.isError).toBe(true);
  });
});

describe("draft_patient_outreach tool (DRY_RUN)", () => {
  it("drafts an SMS outreach for Maria BCS-E gap", async () => {
    const response = await callTool("draft_patient_outreach", {
      patientId: "patient-maria-001",
      gapIds: ["BCS-E"],
      channel: "sms",
      readingLevel: "grade6",
      language: "en",
      tone: "warm",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    const text = result.content[0]!.text;
    expect(text).toContain("Outreach draft");
    expect(text).toContain("sms");

    const structured = JSON.parse(
      text.split("--- Structured Result ---\n")[1]!,
    ) as { body: string; channel: string; llmModel: string };
    expect(structured.channel).toBe("sms");
    expect(structured.body.length).toBeGreaterThan(10);
    expect(structured.llmModel).toBe("dry-run");
  });

  it("drafts an email outreach with subject line", async () => {
    const response = await callTool("draft_patient_outreach", {
      patientId: "patient-maria-001",
      gapIds: ["BCS-E", "HBD"],
      channel: "email",
      tone: "formal",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    const text = result.content[0]!.text;
    expect(text).toContain("Subject:");

    const structured = JSON.parse(
      text.split("--- Structured Result ---\n")[1]!,
    ) as { subject: string | null; channel: string };
    expect(structured.channel).toBe("email");
    expect(structured.subject).toBeTruthy();
  });

  it("returns error for unknown patient", async () => {
    const response = await callTool("draft_patient_outreach", {
      patientId: "nonexistent",
      gapIds: ["BCS-E"],
      channel: "sms",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
      isError: boolean;
    };
    expect(result.isError).toBe(true);
  });
});

describe("rank_gaps_by_priority tool (DRY_RUN)", () => {
  it("ranks Maria's open gaps", async () => {
    const response = await callTool("rank_gaps_by_priority", {
      patientId: "patient-maria-001",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    const text = result.content[0]!.text;
    expect(text).toContain("Priority ranking");
    expect(text).toContain("Structured Result");

    const structured = JSON.parse(
      text.split("--- Structured Result ---\n")[1]!,
    ) as { rankedGaps: Array<{ rank: number }>; llmModel: string };
    expect(structured.rankedGaps.length).toBeGreaterThanOrEqual(1);
    expect(structured.llmModel).toBe("dry-run");
  });

  it("returns message when no open gaps", async () => {
    const response = await callTool("rank_gaps_by_priority", {
      patientId: "patient-james-002",
      gaps: [],
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0]!.text).toContain("No open gaps");
  });
});

describe("panel_gap_summary tool", () => {
  it("summarizes all 4 fixture patients across all measures", async () => {
    const response = await callTool("panel_gap_summary", {
      asOfDate: "2026-04-01",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    const text = result.content[0]!.text;
    expect(text).toContain("Panel Gap Summary");
    expect(text).toContain("4 patients");
    expect(text).toContain("BCS-E");
    expect(text).toContain("COL-E");

    const structured = JSON.parse(
      text.split("--- Structured Result ---\n")[1]!,
    ) as {
      panelSize: number;
      measures: Array<{
        measureId: string;
        openGaps: number;
        financialImpactScore: number;
      }>;
    };
    expect(structured.panelSize).toBe(4);
    expect(structured.measures.length).toBe(5);
  });

  it("filters to specific measures", async () => {
    const response = await callTool("panel_gap_summary", {
      measureIds: ["BCS-E", "HBD"],
      asOfDate: "2026-04-01",
    });
    const result = response["result"] as {
      content: Array<{ type: string; text: string }>;
    };
    const structured = JSON.parse(
      result.content[0]!.text.split("--- Structured Result ---\n")[1]!,
    ) as { measures: Array<{ measureId: string }> };
    expect(structured.measures).toHaveLength(2);
    const ids = structured.measures.map((m) => m.measureId);
    expect(ids).toContain("BCS-E");
    expect(ids).toContain("HBD");
  });
});

function parseResponse(
  text: string,
  id: number,
): Record<string, unknown> | null {
  const lines = text.split("\n").filter((l) => l.startsWith("data: "));
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line.slice(6)) as Record<string, unknown>;
      if (parsed["id"] === id) return parsed;
    } catch {
      // skip
    }
  }
  try {
    const direct = JSON.parse(text) as Record<string, unknown>;
    if (direct["id"] === id) return direct;
  } catch {
    // not direct JSON
  }
  return null;
}
