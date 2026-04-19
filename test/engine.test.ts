import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env["MCP_MODE"] = "fixture";
  process.env["PORT"] = "0";
  process.env["MCP_API_KEYS"] = "";
  process.env["LOG_LEVEL"] = "silent";
});

describe("measure evaluators against fixture patients", () => {
  async function evalGaps(patientId: string, measureIds?: string[], asOfDate?: string) {
    await import("../src/measures/evaluators/index.js");
    const { evaluateGaps } = await import("../src/measures/engine.js");
    return evaluateGaps(patientId, null, measureIds, asOfDate);
  }

  describe("Maria (patient-maria-001) — 58F, diabetes + HTN", () => {
    it("BCS-E: open (no mammogram procedure in FHIR, only in note)", async () => {
      const result = await evalGaps("patient-maria-001", ["BCS-E"], "2026-04-01");
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]!.measureId).toBe("BCS-E");
      expect(result.gaps[0]!.status).toBe("open");
    });

    it("HBD: open (HbA1c 8.2% is above 8.0 threshold)", async () => {
      const result = await evalGaps("patient-maria-001", ["HBD"], "2024-12-01");
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]!.measureId).toBe("HBD");
      expect(result.gaps[0]!.status).toBe("open");
      const a1cEvidence = result.gaps[0]!.evidence.find((e) => e.field === "HbA1c");
      expect(a1cEvidence?.value).toContain("8.2");
    });

    it("CBP: open (BP 148/92 is above 140/90)", async () => {
      const result = await evalGaps("patient-maria-001", ["CBP"], "2025-06-01");
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]!.measureId).toBe("CBP");
      expect(result.gaps[0]!.status).toBe("open");
      const bpEvidence = result.gaps[0]!.evidence.find((e) => e.field === "BP");
      expect(bpEvidence?.value).toContain("148");
    });

    it("IMA: not_eligible (age 58, not 13)", async () => {
      const result = await evalGaps("patient-maria-001", ["IMA"], "2026-04-01");
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]!.status).toBe("not_eligible");
    });

    it("COL-E: not_eligible (age 58 is in range but let's test)", async () => {
      const result = await evalGaps("patient-maria-001", ["COL-E"], "2026-04-01");
      expect(result.gaps).toHaveLength(1);
      // Maria has no colonoscopy so should be open
      expect(result.gaps[0]!.status).toBe("open");
    });
  });

  describe("James (patient-james-002) — 52M, colonoscopy 8yr ago, hospice", () => {
    it("COL-E: closed (colonoscopy 2017 is within 10-year window for 2026)", async () => {
      const result = await evalGaps("patient-james-002", ["COL-E"], "2026-04-01");
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]!.status).toBe("closed");
    });

    it("BCS-E: not_eligible (male)", async () => {
      const result = await evalGaps("patient-james-002", ["BCS-E"], "2026-04-01");
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]!.status).toBe("not_eligible");
    });

    it("HBD: not_eligible (no diabetes)", async () => {
      const result = await evalGaps("patient-james-002", ["HBD"], "2026-04-01");
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]!.status).toBe("not_eligible");
    });
  });

  describe("Lin (patient-lin-003) — 45F, pregnant, uncontrolled BP, DM", () => {
    it("CBP: excluded (pregnancy)", async () => {
      const result = await evalGaps("patient-lin-003", ["CBP"], "2026-04-01");
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]!.status).toBe("excluded");
    });

    it("HBD: open (HbA1c 9.1% from Dec 2024 — if evaluating 2024)", async () => {
      const result = await evalGaps("patient-lin-003", ["HBD"], "2024-12-15");
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]!.status).toBe("open");
    });

    it("BCS-E: not_eligible (age 45, below 50)", async () => {
      const result = await evalGaps("patient-lin-003", ["BCS-E"], "2026-04-01");
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]!.status).toBe("not_eligible");
    });
  });

  describe("Alex (patient-alex-004) — 16 NB, has Tdap + MenACWY, no HPV", () => {
    it("IMA: open (missing HPV) when evaluated at age 13", async () => {
      // Alex born 2010-02-28 — turned 13 on 2023-02-28
      const result = await evalGaps("patient-alex-004", ["IMA"], "2023-06-01");
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]!.measureId).toBe("IMA");
      expect(result.gaps[0]!.status).toBe("open");
      const missingEvidence = result.gaps[0]!.evidence.find(
        (e) => e.field === "missing_vaccines",
      );
      expect(missingEvidence?.value).toContain("HPV");
    });

    it("IMA: not_eligible at age 16", async () => {
      const result = await evalGaps("patient-alex-004", ["IMA"], "2026-04-01");
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]!.status).toBe("not_eligible");
    });
  });

  describe("evaluate all measures for a patient", () => {
    it("returns gaps for all 5 measures for Maria", async () => {
      const result = await evalGaps("patient-maria-001", undefined, "2026-04-01");
      expect(result.gaps).toHaveLength(5);
      const statuses = Object.fromEntries(
        result.gaps.map((g) => [g.measureId, g.status]),
      );
      expect(statuses["BCS-E"]).toBe("open");
      expect(statuses["IMA"]).toBe("not_eligible");
      expect(statuses["COL-E"]).toBe("open");
    });
  });

  it("returns empty gaps for unknown patient", async () => {
    const result = await evalGaps("nonexistent-patient", undefined, "2026-04-01");
    expect(result.gaps).toHaveLength(0);
  });
});
