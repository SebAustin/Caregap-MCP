import {
  registerEvaluator,
  patientAge,
  hasActiveCoverage,
  type PatientContext,
  type GapResult,
  type Evidence,
} from "../engine.js";
import { MEASURE_CVX } from "../../fhir/queries.js";

/**
 * IMA — Immunizations for Adolescents
 * Denominator: Age 13 during MY
 * Numerator: By 13th birthday, must have:
 *   - >= 1 MenACWY (between 11th and 13th birthday)
 *   - >= 1 Tdap (between 10th and 13th birthday)
 *   - >= 2 HPV (between 9th and 13th birthday, if series started < 15)
 */
function evaluate(ctx: PatientContext, asOf: Date): GapResult {
  const spec = { id: "IMA", name: "Immunizations for Adolescents" };
  const evidence: Evidence[] = [];
  const age = patientAge(ctx.patient, asOf);

  if (age === null || age !== 13) {
    return { measureId: spec.id, measureName: spec.name, status: "not_eligible", evidence: [{ resourceType: "Patient", resourceId: ctx.patient.id ?? "", field: "age", value: String(age ?? "unknown") }], confidence: 1.0 };
  }

  if (!hasActiveCoverage(ctx.coverages, asOf)) {
    return { measureId: spec.id, measureName: spec.name, status: "not_eligible", evidence: [{ resourceType: "Coverage", resourceId: "", field: "status", value: "no active coverage" }], confidence: 0.9 };
  }

  const birthDate = new Date(ctx.patient.birthDate!);
  const birthday13 = new Date(birthDate.getFullYear() + 13, birthDate.getMonth(), birthDate.getDate());

  // Check MenACWY (age 11–13)
  const birthday11 = new Date(birthDate.getFullYear() + 11, birthDate.getMonth(), birthDate.getDate());
  const hasMenACWY = ctx.immunizations.some(
    (i) =>
      i.vaccineCode?.coding?.some((c) => c.code === MEASURE_CVX.MENINGOCOCCAL_ACWY) &&
      i.status === "completed" &&
      i.occurrenceDateTime &&
      new Date(i.occurrenceDateTime) >= birthday11 &&
      new Date(i.occurrenceDateTime) <= birthday13,
  );

  // Check Tdap (age 10–13)
  const birthday10 = new Date(birthDate.getFullYear() + 10, birthDate.getMonth(), birthDate.getDate());
  const hasTdap = ctx.immunizations.some(
    (i) =>
      i.vaccineCode?.coding?.some((c) => c.code === MEASURE_CVX.TDAP) &&
      i.status === "completed" &&
      i.occurrenceDateTime &&
      new Date(i.occurrenceDateTime) >= birthday10 &&
      new Date(i.occurrenceDateTime) <= birthday13,
  );

  // Check HPV (age 9–13, need >= 2 doses)
  const birthday9 = new Date(birthDate.getFullYear() + 9, birthDate.getMonth(), birthDate.getDate());
  const hpvDoses = ctx.immunizations.filter(
    (i) =>
      i.vaccineCode?.coding?.some(
        (c) => c.code === MEASURE_CVX.HPV_9VALENT || c.code === MEASURE_CVX.HPV_QUADRIVALENT,
      ) &&
      i.status === "completed" &&
      i.occurrenceDateTime &&
      new Date(i.occurrenceDateTime) >= birthday9 &&
      new Date(i.occurrenceDateTime) <= birthday13,
  );
  const hasHPV = hpvDoses.length >= 2;

  const missingVaccines: string[] = [];
  if (!hasMenACWY) missingVaccines.push("MenACWY");
  if (!hasTdap) missingVaccines.push("Tdap");
  if (!hasHPV) missingVaccines.push(`HPV (${hpvDoses.length}/2 doses)`);

  if (hasMenACWY) evidence.push({ resourceType: "Immunization", resourceId: "", field: "MenACWY", value: "completed" });
  if (hasTdap) evidence.push({ resourceType: "Immunization", resourceId: "", field: "Tdap", value: "completed" });
  evidence.push({ resourceType: "Immunization", resourceId: "", field: "HPV", value: `${hpvDoses.length}/2 doses` });

  if (missingVaccines.length === 0) {
    return { measureId: spec.id, measureName: spec.name, status: "closed", evidence, confidence: 1.0 };
  }

  evidence.push({
    resourceType: "Patient",
    resourceId: ctx.patient.id ?? "",
    field: "missing_vaccines",
    value: missingVaccines.join(", "),
  });

  return {
    measureId: spec.id,
    measureName: spec.name,
    status: "open",
    dueDate: birthday13.toISOString().slice(0, 10),
    evidence,
    confidence: 1.0,
  };
}

registerEvaluator("IMA", evaluate);
