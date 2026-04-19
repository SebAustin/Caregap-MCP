import {
  registerEvaluator,
  patientAge,
  hasConditionCode,
  isDateInRange,
  getMeasurementYearRange,
  hasActiveCoverage,
  type PatientContext,
  type GapResult,
  type Evidence,
} from "../engine.js";
import { MEASURE_SNOMED, MEASURE_LOINC } from "../../fhir/queries.js";

/**
 * HBD — Hemoglobin A1c Control for Patients with Diabetes
 * Denominator: 18–75, diabetes diagnosis
 * Numerator: Most recent HbA1c < 8.0% during MY
 * Note: HbA1c > 9.0% or missing = poor control
 */
function evaluate(ctx: PatientContext, asOf: Date): GapResult {
  const spec = { id: "HBD", name: "Hemoglobin A1c Control for Patients with Diabetes" };
  const evidence: Evidence[] = [];
  const age = patientAge(ctx.patient, asOf);
  const { start, end } = getMeasurementYearRange(asOf);

  if (age === null || age < 18 || age > 75) {
    return { measureId: spec.id, measureName: spec.name, status: "not_eligible", evidence: [{ resourceType: "Patient", resourceId: ctx.patient.id ?? "", field: "age", value: String(age ?? "unknown") }], confidence: 1.0 };
  }

  // Must have diabetes diagnosis
  const hasDiabetes =
    hasConditionCode(ctx.conditions, "http://snomed.info/sct", MEASURE_SNOMED.DIABETES_TYPE2) ||
    hasConditionCode(ctx.conditions, "http://snomed.info/sct", "46635009"); // DM type 1
  if (!hasDiabetes) {
    return { measureId: spec.id, measureName: spec.name, status: "not_eligible", evidence: [{ resourceType: "Condition", resourceId: "", field: "code", value: "No diabetes diagnosis" }], confidence: 1.0 };
  }

  if (!hasActiveCoverage(ctx.coverages, asOf)) {
    return { measureId: spec.id, measureName: spec.name, status: "not_eligible", evidence: [{ resourceType: "Coverage", resourceId: "", field: "status", value: "no active coverage" }], confidence: 0.9 };
  }

  // Exclusion: hospice
  if (hasConditionCode(ctx.conditions, "http://snomed.info/sct", MEASURE_SNOMED.HOSPICE_CARE)) {
    return { measureId: spec.id, measureName: spec.name, status: "excluded", evidence: [{ resourceType: "Condition", resourceId: "", field: "code", value: "Hospice care" }], confidence: 1.0 };
  }

  // Find most recent HbA1c in measurement year
  const a1cObs = ctx.observations
    .filter(
      (o) =>
        o.code?.coding?.some((c) => c.code === MEASURE_LOINC.HBA1C) &&
        isDateInRange(o.effectiveDateTime, start, end),
    )
    .sort((a, b) => {
      const da = new Date(a.effectiveDateTime ?? 0);
      const db = new Date(b.effectiveDateTime ?? 0);
      return db.getTime() - da.getTime();
    });

  if (a1cObs.length === 0) {
    // No HbA1c test — gap open (poor control by definition in HEDIS)
    evidence.push({ resourceType: "Observation", resourceId: "", field: "HbA1c", value: "No HbA1c test in measurement year" });
    return {
      measureId: spec.id,
      measureName: spec.name,
      status: "open",
      dueDate: end.toISOString().slice(0, 10),
      evidence,
      confidence: 0.9,
    };
  }

  const latest = a1cObs[0]!;
  const value = latest.valueQuantity?.value;
  evidence.push({
    resourceType: "Observation",
    resourceId: latest.id ?? "",
    field: "HbA1c",
    value: value !== undefined ? `${value}%` : "no value",
    date: latest.effectiveDateTime,
  });

  if (value !== undefined && value < 8.0) {
    return { measureId: spec.id, measureName: spec.name, status: "closed", evidence, confidence: 1.0 };
  }

  // HbA1c >= 8.0 or > 9.0 — gap open
  return {
    measureId: spec.id,
    measureName: spec.name,
    status: "open",
    dueDate: end.toISOString().slice(0, 10),
    evidence,
    confidence: 1.0,
  };
}

registerEvaluator("HBD", evaluate);
