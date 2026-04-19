/**
 * Prebuilt FHIR search queries used by measure engines.
 * Each function returns the resourceType + search params needed.
 */

export function patientQuery(patientId: string) {
  return { resourceType: "Patient" as const, path: `Patient/${patientId}` };
}

export function conditionsForPatient(patientId: string) {
  return {
    resourceType: "Condition" as const,
    params: {
      patient: patientId,
      "clinical-status": "active,recurrence,relapse",
    },
  };
}

export function observationsForPatient(
  patientId: string,
  codes?: string[],
) {
  const params: Record<string, string> = { patient: patientId };
  if (codes && codes.length > 0) {
    params["code"] = codes.join(",");
  }
  return { resourceType: "Observation" as const, params };
}

export function proceduresForPatient(
  patientId: string,
  codes?: string[],
) {
  const params: Record<string, string> = { patient: patientId };
  if (codes && codes.length > 0) {
    params["code"] = codes.join(",");
  }
  return { resourceType: "Procedure" as const, params };
}

export function immunizationsForPatient(patientId: string) {
  return {
    resourceType: "Immunization" as const,
    params: { patient: patientId },
  };
}

export function coverageForPatient(patientId: string) {
  return {
    resourceType: "Coverage" as const,
    params: { beneficiary: patientId },
  };
}

export function documentReferencesForPatient(patientId: string) {
  return {
    resourceType: "DocumentReference" as const,
    params: { patient: patientId },
  };
}

export function diagnosticReportsForPatient(
  patientId: string,
  codes?: string[],
) {
  const params: Record<string, string> = { patient: patientId };
  if (codes && codes.length > 0) {
    params["code"] = codes.join(",");
  }
  return { resourceType: "DiagnosticReport" as const, params };
}

/** LOINC codes we search for, organized by measure */
export const MEASURE_LOINC = {
  HBA1C: "4548-4",
  BLOOD_PRESSURE: "85354-9",
  SYSTOLIC: "8480-6",
  DIASTOLIC: "8462-4",
  MAMMOGRAM: "24606-6",
  COLONOSCOPY_REPORT: "18746-8",
  FIT_TEST: "29771-3",
  FIT_DNA: "77353-1",
  FLEXIBLE_SIGMOIDOSCOPY: "18500-9",
  CT_COLONOGRAPHY: "79101-2",
} as const;

/** SNOMED codes for common conditions */
export const MEASURE_SNOMED = {
  DIABETES_TYPE2: "44054006",
  HYPERTENSION: "38341003",
  PREGNANCY: "77386006",
  BILATERAL_MASTECTOMY: "27865001",
  HOSPICE_CARE: "385763009",
  COLONOSCOPY: "73761001",
  MAMMOGRAPHY: "71651007",
} as const;

/** CVX codes for immunizations */
export const MEASURE_CVX = {
  TDAP: "115",
  HPV_9VALENT: "165",
  HPV_QUADRIVALENT: "62",
  MENINGOCOCCAL_ACWY: "114",
  MENINGOCOCCAL_B: "162",
} as const;
