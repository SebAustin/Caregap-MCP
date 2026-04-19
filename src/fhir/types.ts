/**
 * Minimal FHIR R4 type definitions covering only the resources
 * we actually consume for quality-measure gap evaluation.
 */

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: { lastUpdated?: string; versionId?: string };
}

export interface Coding {
  system?: string;
  code?: string;
  display?: string;
}

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface Reference {
  reference?: string;
  display?: string;
}

export interface Period {
  start?: string;
  end?: string;
}

export interface HumanName {
  use?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  text?: string;
}

export interface Address {
  use?: string;
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface ContactPoint {
  system?: string;
  value?: string;
  use?: string;
}

export interface Extension {
  url: string;
  valueString?: string;
  valueCode?: string;
  valueCoding?: Coding;
  valueCodeableConcept?: CodeableConcept;
}

export interface Patient extends FhirResource {
  resourceType: "Patient";
  name?: HumanName[];
  gender?: "male" | "female" | "other" | "unknown";
  birthDate?: string;
  address?: Address[];
  telecom?: ContactPoint[];
  communication?: Array<{
    language: CodeableConcept;
    preferred?: boolean;
  }>;
  extension?: Extension[];
}

export interface Condition extends FhirResource {
  resourceType: "Condition";
  subject?: Reference;
  code?: CodeableConcept;
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  onsetDateTime?: string;
  abatementDateTime?: string;
  recordedDate?: string;
  category?: CodeableConcept[];
}

export interface Observation extends FhirResource {
  resourceType: "Observation";
  subject?: Reference;
  code?: CodeableConcept;
  status?: string;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  valueQuantity?: { value?: number; unit?: string; system?: string; code?: string };
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  issued?: string;
  category?: CodeableConcept[];
  component?: Array<{
    code: CodeableConcept;
    valueQuantity?: { value?: number; unit?: string };
  }>;
}

export interface Procedure extends FhirResource {
  resourceType: "Procedure";
  subject?: Reference;
  code?: CodeableConcept;
  status?: string;
  performedDateTime?: string;
  performedPeriod?: Period;
  category?: CodeableConcept;
}

export interface Immunization extends FhirResource {
  resourceType: "Immunization";
  patient?: Reference;
  vaccineCode?: CodeableConcept;
  status?: string;
  occurrenceDateTime?: string;
  occurrenceString?: string;
}

export interface MedicationRequest extends FhirResource {
  resourceType: "MedicationRequest";
  subject?: Reference;
  medicationCodeableConcept?: CodeableConcept;
  status?: string;
  authoredOn?: string;
  intent?: string;
}

export interface Coverage extends FhirResource {
  resourceType: "Coverage";
  beneficiary?: Reference;
  status?: string;
  type?: CodeableConcept;
  period?: Period;
  payor?: Reference[];
  subscriberId?: string;
}

export interface DocumentReference extends FhirResource {
  resourceType: "DocumentReference";
  subject?: Reference;
  type?: CodeableConcept;
  status?: string;
  date?: string;
  content?: Array<{
    attachment?: {
      contentType?: string;
      data?: string;
      url?: string;
      title?: string;
    };
  }>;
  description?: string;
}

export interface DiagnosticReport extends FhirResource {
  resourceType: "DiagnosticReport";
  subject?: Reference;
  code?: CodeableConcept;
  status?: string;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  issued?: string;
  conclusion?: string;
  result?: Reference[];
  category?: CodeableConcept[];
}

export interface BundleEntry<T extends FhirResource = FhirResource> {
  resource?: T;
  fullUrl?: string;
  search?: { mode?: string };
}

export interface Bundle<T extends FhirResource = FhirResource> extends FhirResource {
  resourceType: "Bundle";
  type?: string;
  total?: number;
  entry?: BundleEntry<T>[];
  link?: Array<{ relation: string; url: string }>;
}

export type AnyResource =
  | Patient
  | Condition
  | Observation
  | Procedure
  | Immunization
  | MedicationRequest
  | Coverage
  | DocumentReference
  | DiagnosticReport;
