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
 * CBP — Controlling High Blood Pressure
 * Denominator: 18–85, hypertension dx with onset before July 1 of MY
 * Numerator: Most recent BP < 140/90 during MY
 * Exclusions: pregnancy, ESRD, hospice
 */
function evaluate(ctx: PatientContext, asOf: Date): GapResult {
  const spec = { id: "CBP", name: "Controlling High Blood Pressure" };
  const evidence: Evidence[] = [];
  const age = patientAge(ctx.patient, asOf);
  const { start, end } = getMeasurementYearRange(asOf);

  if (age === null || age < 18 || age > 85) {
    return { measureId: spec.id, measureName: spec.name, status: "not_eligible", evidence: [{ resourceType: "Patient", resourceId: ctx.patient.id ?? "", field: "age", value: String(age ?? "unknown") }], confidence: 1.0 };
  }

  // Must have hypertension
  if (!hasConditionCode(ctx.conditions, "http://snomed.info/sct", MEASURE_SNOMED.HYPERTENSION)) {
    return { measureId: spec.id, measureName: spec.name, status: "not_eligible", evidence: [{ resourceType: "Condition", resourceId: "", field: "code", value: "No hypertension diagnosis" }], confidence: 1.0 };
  }

  if (!hasActiveCoverage(ctx.coverages, asOf)) {
    return { measureId: spec.id, measureName: spec.name, status: "not_eligible", evidence: [{ resourceType: "Coverage", resourceId: "", field: "status", value: "no active coverage" }], confidence: 0.9 };
  }

  // Exclusion: pregnancy
  if (hasConditionCode(ctx.conditions, "http://snomed.info/sct", MEASURE_SNOMED.PREGNANCY)) {
    return { measureId: spec.id, measureName: spec.name, status: "excluded", evidence: [{ resourceType: "Condition", resourceId: "", field: "code", value: "Pregnancy" }], confidence: 1.0 };
  }

  // Exclusion: hospice
  if (hasConditionCode(ctx.conditions, "http://snomed.info/sct", MEASURE_SNOMED.HOSPICE_CARE)) {
    return { measureId: spec.id, measureName: spec.name, status: "excluded", evidence: [{ resourceType: "Condition", resourceId: "", field: "code", value: "Hospice care" }], confidence: 1.0 };
  }

  // Find most recent BP in measurement year
  const bpObs = ctx.observations
    .filter(
      (o) =>
        o.code?.coding?.some((c) => c.code === MEASURE_LOINC.BLOOD_PRESSURE) &&
        isDateInRange(o.effectiveDateTime, start, end),
    )
    .sort((a, b) => {
      const da = new Date(a.effectiveDateTime ?? 0);
      const db = new Date(b.effectiveDateTime ?? 0);
      return db.getTime() - da.getTime();
    });

  if (bpObs.length === 0) {
    evidence.push({ resourceType: "Observation", resourceId: "", field: "BP", value: "No BP reading in measurement year" });
    return { measureId: spec.id, measureName: spec.name, status: "open", dueDate: end.toISOString().slice(0, 10), evidence, confidence: 0.8 };
  }

  const latest = bpObs[0]!;
  const systolicComp = latest.component?.find((c) =>
    c.code.coding?.some((cd) => cd.code === MEASURE_LOINC.SYSTOLIC),
  );
  const diastolicComp = latest.component?.find((c) =>
    c.code.coding?.some((cd) => cd.code === MEASURE_LOINC.DIASTOLIC),
  );

  const systolic = systolicComp?.valueQuantity?.value;
  const diastolic = diastolicComp?.valueQuantity?.value;

  evidence.push({
    resourceType: "Observation",
    resourceId: latest.id ?? "",
    field: "BP",
    value: `${systolic ?? "?"}/${diastolic ?? "?"} mmHg`,
    date: latest.effectiveDateTime,
  });

  if (systolic !== undefined && diastolic !== undefined && systolic < 140 && diastolic < 90) {
    return { measureId: spec.id, measureName: spec.name, status: "closed", evidence, confidence: 1.0 };
  }

  return {
    measureId: spec.id,
    measureName: spec.name,
    status: "open",
    dueDate: end.toISOString().slice(0, 10),
    evidence,
    confidence: 1.0,
  };
}

registerEvaluator("CBP", evaluate);
