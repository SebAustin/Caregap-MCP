import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env["MCP_MODE"] = "fixture";
  process.env["PORT"] = "0";
  process.env["MCP_API_KEYS"] = "";
  process.env["LOG_LEVEL"] = "silent";
});

describe("fixture loader", () => {
  it("loads all 4 patients", async () => {
    const { getFixturePatientIds } = await import(
      "../src/fixtures/loader.js"
    );
    const ids = getFixturePatientIds();
    expect(ids).toHaveLength(4);
    expect(ids).toContain("patient-maria-001");
    expect(ids).toContain("patient-james-002");
    expect(ids).toContain("patient-lin-003");
    expect(ids).toContain("patient-alex-004");
  });

  it("reads a patient by id", async () => {
    const { fixtureRead } = await import("../src/fixtures/loader.js");
    const patient = fixtureRead("Patient/patient-maria-001");
    expect(patient).not.toBeNull();
    expect(patient?.resourceType).toBe("Patient");
    expect(patient?.id).toBe("patient-maria-001");
  });

  it("returns null for unknown resource", async () => {
    const { fixtureRead } = await import("../src/fixtures/loader.js");
    const result = fixtureRead("Patient/nonexistent");
    expect(result).toBeNull();
  });

  it("searches conditions for Maria (diabetes + hypertension)", async () => {
    const { fixtureSearch } = await import("../src/fixtures/loader.js");
    const conditions = fixtureSearch("Condition", {
      patient: "patient-maria-001",
    });
    expect(conditions.length).toBeGreaterThanOrEqual(2);
    const codes = conditions.map(
      (c: Record<string, unknown>) =>
        ((c as { code?: { coding?: Array<{ code?: string }> } }).code
          ?.coding?.[0]?.code),
    );
    expect(codes).toContain("44054006"); // diabetes
    expect(codes).toContain("38341003"); // hypertension
  });

  it("searches observations for Maria", async () => {
    const { fixtureSearch } = await import("../src/fixtures/loader.js");
    const obs = fixtureSearch("Observation", {
      patient: "patient-maria-001",
    });
    expect(obs.length).toBeGreaterThanOrEqual(2); // HbA1c + BP
  });

  it("searches immunizations for Alex", async () => {
    const { fixtureSearch } = await import("../src/fixtures/loader.js");
    const imms = fixtureSearch("Immunization", {
      patient: "patient-alex-004",
    });
    expect(imms.length).toBeGreaterThanOrEqual(2); // Tdap + MenACWY
  });

  it("searches coverage for Lin", async () => {
    const { fixtureSearch } = await import("../src/fixtures/loader.js");
    const cov = fixtureSearch("Coverage", {
      beneficiary: "patient-lin-003",
    });
    expect(cov.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array for patient with no matching resources", async () => {
    const { fixtureSearch } = await import("../src/fixtures/loader.js");
    const result = fixtureSearch("Immunization", {
      patient: "patient-maria-001",
    });
    expect(result).toHaveLength(0);
  });
});
