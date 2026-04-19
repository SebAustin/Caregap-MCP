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
import { MEASURE_SNOMED } from "../../fhir/queries.js";

/**
 * BCS-E — Breast Cancer Screening
 * Denominator: Female, 50–74, continuously enrolled
 * Numerator: Mammogram in past 27 months (Oct 1, 2 years prior through Dec 31 MY)
 * Exclusions: Bilateral mastectomy, hospice
 */
function evaluate(ctx: PatientContext, asOf: Date): GapResult {
  const spec = { id: "BCS-E", name: "Breast Cancer Screening" };
  const evidence: Evidence[] = [];
  const age = patientAge(ctx.patient, asOf);
  const { end } = getMeasurementYearRange(asOf);

  if (ctx.patient.gender !== "female") {
    return { measureId: spec.id, measureName: spec.name, status: "not_eligible", evidence: [{ resourceType: "Patient", resourceId: ctx.patient.id ?? "", field: "gender", value: ctx.patient.gender ?? "unknown" }], confidence: 1.0 };
  }

  if (age === null || age < 50 || age > 74) {
    return { measureId: spec.id, measureName: spec.name, status: "not_eligible", evidence: [{ resourceType: "Patient", resourceId: ctx.patient.id ?? "", field: "age", value: String(age ?? "unknown") }], confidence: 1.0 };
  }

  if (!hasActiveCoverage(ctx.coverages, asOf)) {
    return { measureId: spec.id, measureName: spec.name, status: "not_eligible", evidence: [{ resourceType: "Coverage", resourceId: "", field: "status", value: "no active coverage" }], confidence: 0.9 };
  }

  // Exclusion: bilateral mastectomy
  if (hasConditionCode(ctx.conditions, "http://snomed.info/sct", MEASURE_SNOMED.BILATERAL_MASTECTOMY)) {
    const cond = ctx.conditions.find((c) => c.code?.coding?.some((cd) => cd.code === MEASURE_SNOMED.BILATERAL_MASTECTOMY));
    evidence.push({ resourceType: "Condition", resourceId: cond?.id ?? "", field: "code", value: "Bilateral mastectomy", date: cond?.recordedDate });
    return { measureId: spec.id, measureName: spec.name, status: "excluded", evidence, confidence: 1.0 };
  }

  // Exclusion: hospice
  if (hasConditionCode(ctx.conditions, "http://snomed.info/sct", MEASURE_SNOMED.HOSPICE_CARE)) {
    return { measureId: spec.id, measureName: spec.name, status: "excluded", evidence: [{ resourceType: "Condition", resourceId: "", field: "code", value: "Hospice care" }], confidence: 1.0 };
  }

  // Numerator: mammogram in lookback window (Oct 1, 2 years prior through end of MY)
  const lookbackStart = new Date(asOf.getFullYear() - 2, 9, 1); // Oct 1, 2 years prior
  const lookbackEnd = end;

  // Check procedures
  const mammoProc = ctx.procedures.find(
    (p) => p.code?.coding?.some((c) => c.code === MEASURE_SNOMED.MAMMOGRAPHY) &&
      isDateInRange(p.performedDateTime ?? p.performedPeriod?.start, lookbackStart, lookbackEnd),
  );
  if (mammoProc) {
    evidence.push({ resourceType: "Procedure", resourceId: mammoProc.id ?? "", field: "code", value: "Mammography", date: mammoProc.performedDateTime });
    return { measureId: spec.id, measureName: spec.name, status: "closed", evidence, confidence: 1.0 };
  }

  // Check diagnostic reports for mammogram
  const mammoDx = ctx.observations.find(
    (o) => o.code?.coding?.some((c) => c.code === "24606-6") &&
      isDateInRange(o.effectiveDateTime, lookbackStart, lookbackEnd),
  );
  if (mammoDx) {
    evidence.push({ resourceType: "Observation", resourceId: mammoDx.id ?? "", field: "code", value: "Mammography report", date: mammoDx.effectiveDateTime });
    return { measureId: spec.id, measureName: spec.name, status: "closed", evidence, confidence: 1.0 };
  }

  // Gap is open
  evidence.push({ resourceType: "Patient", resourceId: ctx.patient.id ?? "", field: "mammogram", value: "No mammogram found in lookback window" });
  return {
    measureId: spec.id,
    measureName: spec.name,
    status: "open",
    dueDate: end.toISOString().slice(0, 10),
    evidence,
    confidence: 0.85,
  };
}

registerEvaluator("BCS-E", evaluate);
