import type {
  Patient,
  Condition,
  Observation,
  Procedure,
  Immunization,
  Coverage,
  DocumentReference,
  FhirResource,
  Coding,
} from "../fhir/types.js";
import { config } from "../config.js";
import { fixtureRead, fixtureSearch } from "../fixtures/loader.js";
import { FhirClient } from "../fhir/client.js";
import type { FhirContext } from "../middleware/sharpContext.js";
import { getAllMeasureIds, getMeasureSpec } from "./registry.js";

export type GapStatus = "open" | "closed" | "excluded" | "not_eligible";

export interface Evidence {
  resourceType: string;
  resourceId: string;
  field: string;
  value: string;
  date?: string;
}

export interface GapResult {
  measureId: string;
  measureName: string;
  status: GapStatus;
  dueDate?: string;
  evidence: Evidence[];
  confidence: number;
}

export interface PatientContext {
  patient: Patient;
  conditions: Condition[];
  observations: Observation[];
  procedures: Procedure[];
  immunizations: Immunization[];
  coverages: Coverage[];
  documentReferences: DocumentReference[];
}

/** Load all relevant resources for a patient */
export async function loadPatientContext(
  patientId: string,
  fhirCtx: FhirContext | null,
): Promise<PatientContext | null> {
  if (config.MCP_MODE === "fixture" || !fhirCtx) {
    return loadFixtureContext(patientId);
  }
  return loadFhirContext(patientId, fhirCtx);
}

function loadFixtureContext(patientId: string): PatientContext | null {
  const patient = fixtureRead<Patient>(`Patient/${patientId}`);
  if (!patient) return null;

  return {
    patient,
    conditions: fixtureSearch<Condition>("Condition", { patient: patientId }),
    observations: fixtureSearch<Observation>("Observation", { patient: patientId }),
    procedures: fixtureSearch<Procedure>("Procedure", { patient: patientId }),
    immunizations: fixtureSearch<Immunization>("Immunization", { patient: patientId }),
    coverages: fixtureSearch<Coverage>("Coverage", { beneficiary: patientId }),
    documentReferences: fixtureSearch<DocumentReference>("DocumentReference", { patient: patientId }),
  };
}

async function loadFhirContext(
  patientId: string,
  fhirCtx: FhirContext,
): Promise<PatientContext | null> {
  const client = new FhirClient(fhirCtx);
  const patient = await client.read<Patient>(`Patient/${patientId}`);
  if (!patient) return null;

  const [conditions, observations, procedures, immunizations, coverages, documentReferences] =
    await Promise.all([
      client.search<Condition>("Condition", { patient: patientId }),
      client.search<Observation>("Observation", { patient: patientId }),
      client.search<Procedure>("Procedure", { patient: patientId }),
      client.search<Immunization>("Immunization", { patient: patientId }),
      client.search<Coverage>("Coverage", { beneficiary: patientId }),
      client.search<DocumentReference>("DocumentReference", { patient: patientId }),
    ]);

  return { patient, conditions, observations, procedures, immunizations, coverages, documentReferences };
}

/** Evaluator function signature — each measure implements this */
export type MeasureEvaluator = (
  ctx: PatientContext,
  asOfDate: Date,
) => GapResult;

const evaluatorMap = new Map<string, MeasureEvaluator>();

export function registerEvaluator(measureId: string, evaluator: MeasureEvaluator): void {
  evaluatorMap.set(measureId, evaluator);
}

export function getEvaluator(measureId: string): MeasureEvaluator | undefined {
  return evaluatorMap.get(measureId);
}

/** Run all (or a subset of) measure evaluators for a patient */
export async function evaluateGaps(
  patientId: string,
  fhirCtx: FhirContext | null,
  measureIds?: string[],
  asOfDate?: string,
): Promise<{ patientId: string; asOfDate: string; gaps: GapResult[] }> {
  const now = asOfDate ? new Date(asOfDate) : new Date();
  const ctx = await loadPatientContext(patientId, fhirCtx);

  if (!ctx) {
    return {
      patientId,
      asOfDate: now.toISOString().slice(0, 10),
      gaps: [],
    };
  }

  const ids = measureIds ?? getAllMeasureIds();
  const gaps: GapResult[] = [];

  for (const id of ids) {
    const evaluator = evaluatorMap.get(id);
    if (!evaluator) continue;
    gaps.push(evaluator(ctx, now));
  }

  return {
    patientId,
    asOfDate: now.toISOString().slice(0, 10),
    gaps,
  };
}

// ── Shared helpers used by individual measure evaluators ──

export function patientAge(patient: Patient, asOf: Date): number | null {
  if (!patient.birthDate) return null;
  const birth = new Date(patient.birthDate);
  let age = asOf.getFullYear() - birth.getFullYear();
  const monthDiff = asOf.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function hasCoding(codings: Coding[] | undefined, system: string, code: string): boolean {
  if (!codings) return false;
  return codings.some((c) => c.system === system && c.code === code);
}

export function hasAnyCoding(codings: Coding[] | undefined, system: string, codes: string[]): boolean {
  if (!codings) return false;
  return codings.some((c) => c.system === system && codes.includes(c.code ?? ""));
}

export function hasConditionCode(conditions: Condition[], system: string, code: string): boolean {
  return conditions.some((c) => hasCoding(c.code?.coding, system, code));
}

export function findConditionByCode(conditions: Condition[], system: string, code: string): Condition | undefined {
  return conditions.find((c) => hasCoding(c.code?.coding, system, code));
}

export function isDateInRange(dateStr: string | undefined, start: Date, end: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

export function getMeasurementYearRange(asOf: Date): { start: Date; end: Date } {
  const year = asOf.getFullYear();
  return {
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31),
  };
}

export function hasActiveCoverage(coverages: Coverage[], asOf: Date): boolean {
  return coverages.some((c) => {
    if (c.status !== "active") return false;
    if (!c.period) return true;
    const start = c.period.start ? new Date(c.period.start) : new Date(0);
    const end = c.period.end ? new Date(c.period.end) : new Date("2099-12-31");
    return asOf >= start && asOf <= end;
  });
}
