import { describe, it, expect } from "vitest";
import {
  getMeasureSpec,
  getAllMeasureIds,
  getAllMeasureSpecs,
} from "../src/measures/registry.js";

describe("measure registry", () => {
  it("exposes all 5 measures", () => {
    const ids = getAllMeasureIds();
    expect(ids).toHaveLength(5);
    expect(ids).toContain("BCS-E");
    expect(ids).toContain("COL-E");
    expect(ids).toContain("CBP");
    expect(ids).toContain("HBD");
    expect(ids).toContain("IMA");
  });

  it("returns undefined for unknown measure ID", () => {
    expect(getMeasureSpec("FAKE-001")).toBeUndefined();
  });

  describe("BCS-E spec", () => {
    it("has correct structure", () => {
      const spec = getMeasureSpec("BCS-E");
      expect(spec).toBeDefined();
      expect(spec!.name).toBe("Breast Cancer Screening");
      expect(spec!.gender).toBe("female");
      expect(spec!.ageRange).toEqual({ min: 50, max: 74 });
      expect(spec!.denominatorCriteria.length).toBeGreaterThan(0);
      expect(spec!.numeratorCriteria.length).toBeGreaterThan(0);
      expect(spec!.exclusionCriteria.length).toBeGreaterThan(0);
      expect(spec!.valueSets.length).toBeGreaterThan(0);
    });
  });

  describe("COL-E spec", () => {
    it("lists multiple screening modalities in numerator", () => {
      const spec = getMeasureSpec("COL-E");
      expect(spec).toBeDefined();
      expect(spec!.numeratorCriteria.length).toBeGreaterThanOrEqual(3);
      expect(spec!.ageRange).toEqual({ min: 45, max: 75 });
    });
  });

  describe("CBP spec", () => {
    it("targets hypertension with BP thresholds", () => {
      const spec = getMeasureSpec("CBP");
      expect(spec).toBeDefined();
      expect(spec!.name).toContain("Blood Pressure");
      expect(spec!.ageRange).toEqual({ min: 18, max: 85 });
      const numerator = spec!.numeratorCriteria.join(" ");
      expect(numerator).toContain("140");
      expect(numerator).toContain("90");
    });
  });

  describe("HBD spec", () => {
    it("targets diabetes with A1c thresholds", () => {
      const spec = getMeasureSpec("HBD");
      expect(spec).toBeDefined();
      expect(spec!.name).toContain("Hemoglobin A1c");
      expect(spec!.ageRange).toEqual({ min: 18, max: 75 });
      const numerator = spec!.numeratorCriteria.join(" ");
      expect(numerator).toContain("8.0");
    });
  });

  describe("IMA spec", () => {
    it("targets adolescent immunizations", () => {
      const spec = getMeasureSpec("IMA");
      expect(spec).toBeDefined();
      expect(spec!.ageRange).toEqual({ min: 13, max: 13 });
      const numerator = spec!.numeratorCriteria.join(" ");
      expect(numerator).toContain("Tdap");
      expect(numerator).toContain("HPV");
      expect(numerator).toContain("meningococcal");
    });
  });

  it("all specs have required fields", () => {
    const specs = getAllMeasureSpecs();
    for (const spec of specs) {
      expect(spec.id).toBeTruthy();
      expect(spec.name).toBeTruthy();
      expect(spec.version).toBeTruthy();
      expect(spec.steward).toBeTruthy();
      expect(spec.description.length).toBeGreaterThan(50);
      expect(spec.denominatorCriteria.length).toBeGreaterThan(0);
      expect(spec.numeratorCriteria.length).toBeGreaterThan(0);
      expect(spec.exclusionCriteria.length).toBeGreaterThan(0);
      expect(spec.valueSets.length).toBeGreaterThan(0);
      expect(spec.clinicalDomain).toBeTruthy();
    }
  });
});
