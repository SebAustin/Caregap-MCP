import type { MeasureSpec } from "../registry.js";

/**
 * HEDIS HBD — Hemoglobin A1c Control for Patients with Diabetes
 * Source: NCQA HEDIS MY 2024, CMS eCQM CMS122v12
 * TODO(spec-verify) — verify A1c thresholds and diabetes value sets against current HEDIS Technical Specifications
 */
export const hba1cSpec: MeasureSpec = {
  id: "HBD",
  name: "Hemoglobin A1c Control for Patients with Diabetes",
  shortName: "HbA1c",
  version: "HEDIS MY 2024",
  steward: "NCQA",
  description:
    "The percentage of patients 18–75 years of age with diabetes (type 1 and type 2) whose most " +
    "recent hemoglobin A1c (HbA1c) level is < 8.0%. This measure also tracks patients with poor " +
    "control (HbA1c > 9.0%). Glycemic control is critical to preventing microvascular and " +
    "macrovascular complications of diabetes.",
  measurementPeriod: { anchor: "calendar_year" },
  denominatorCriteria: [
    "Age 18–75 as of December 31 of the measurement year",
    "Diagnosis of diabetes (type 1 or type 2) on or before the measurement year",
    "Continuous enrollment during the measurement year with no more than one gap of up to 45 days",
  ],
  numeratorCriteria: [
    "Most recent HbA1c level < 8.0% during the measurement year (good control)",
    "Note: HbA1c > 9.0% or no HbA1c test during the measurement year indicates poor control",
  ],
  exclusionCriteria: [
    "Hospice or palliative care enrollment",
    "Deceased during the measurement year",
    "65+ with frailty and advanced illness",
  ],
  valueSets: [
    { oid: "2.16.840.1.113883.3.464.1003.103.12.1001", name: "Diabetes" },
    { oid: "2.16.840.1.113883.3.464.1003.198.12.1013", name: "HbA1c Laboratory Test" },
  ],
  ageRange: { min: 18, max: 75 },
  gender: "any",
  mipsWeight: 3,
  clinicalDomain: "Chronic Conditions",
};
