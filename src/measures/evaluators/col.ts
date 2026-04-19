import {
  registerEvaluator,
  patientAge,
  hasConditionCode,
  isDateInRange,
  getMeasurementYearRange,
  hasActiveCoverage,
  hasCoding,
  type PatientContext,
  type GapResult,
  type Evidence,
} from "../engine.js";
import { MEASURE_SNOMED } from "../../fhir/queries.js";

/**
 * COL-E — Colorectal Cancer Screening
 * Denominator: 45–75, continuously enrolled
 * Numerator: Any of the following screening modalities:
 *   - FOBT in MY
 *   - FIT-DNA in MY or 2 years prior
 *   - Flex sig in MY or 4 years prior
 *   - Colonoscopy in MY or 9 years prior
 *   - CT colonography in MY or 4 years prior
 * Exclusions: colorectal cancer, total colectomy, hospice
 */
function evaluate(ctx: PatientContext, asOf: Date): GapResult {
  const spec = { id: "COL-E", name: "Colorectal Cancer Screening" };
  const evidence: Evidence[] = [];
  const age = patientAge(ctx.patient, asOf);
  const { end } = getMeasurementYearRange(asOf);
  const year = asOf.getFullYear();

  if (age === null || age < 45 || age > 75) {
    return { measureId: spec.id, measureName: spec.name, status: "not_eligible", evidence: [{ resourceType: "Patient", resourceId: ctx.patient.id ?? "", field: "age", value: String(age ?? "unknown") }], confidence: 1.0 };
  }

  if (!hasActiveCoverage(ctx.coverages, asOf)) {
    return { measureId: spec.id, measureName: spec.name, status: "not_eligible", evidence: [{ resourceType: "Coverage", resourceId: "", field: "status", value: "no active coverage" }], confidence: 0.9 };
  }

  // Exclusion: hospice
  if (hasConditionCode(ctx.conditions, "http://snomed.info/sct", MEASURE_SNOMED.HOSPICE_CARE)) {
    return { measureId: spec.id, measureName: spec.name, status: "excluded", evidence: [{ resourceType: "Condition", resourceId: "", field: "code", value: "Hospice care" }], confidence: 1.0 };
  }

  // Check colonoscopy in past 10 years (MY + 9 years prior)
  const colonoscopyStart = new Date(year - 9, 0, 1);
  const colonoscopy = ctx.procedures.find(
    (p) =>
      hasCoding(p.code?.coding, "http://snomed.info/sct", MEASURE_SNOMED.COLONOSCOPY) &&
      isDateInRange(p.performedDateTime ?? p.performedPeriod?.start, colonoscopyStart, end),
  );
  if (colonoscopy) {
    evidence.push({
      resourceType: "Procedure",
      resourceId: colonoscopy.id ?? "",
      field: "code",
      value: "Colonoscopy",
      date: colonoscopy.performedDateTime,
    });
    return { measureId: spec.id, measureName: spec.name, status: "closed", evidence, confidence: 1.0 };
  }

  // TODO(spec-verify): check FOBT, FIT-DNA, flex sig, CT colonography via Observation/DiagnosticReport codes

  // Gap open — no qualifying screening found
  evidence.push({
    resourceType: "Patient",
    resourceId: ctx.patient.id ?? "",
    field: "colorectal_screening",
    value: "No qualifying colorectal cancer screening found",
  });
  return {
    measureId: spec.id,
    measureName: spec.name,
    status: "open",
    dueDate: end.toISOString().slice(0, 10),
    evidence,
    confidence: 0.85,
  };
}

registerEvaluator("COL-E", evaluate);
