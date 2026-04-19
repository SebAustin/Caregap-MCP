import type { MeasureSpec } from "../registry.js";

/**
 * HEDIS CBP — Controlling High Blood Pressure
 * Source: NCQA HEDIS MY 2024, CMS eCQM CMS165v12
 * TODO(spec-verify) — verify BP thresholds and age-specific targets against current HEDIS Technical Specifications
 */
export const cbpSpec: MeasureSpec = {
  id: "CBP",
  name: "Controlling High Blood Pressure",
  shortName: "CBP",
  version: "HEDIS MY 2024",
  steward: "NCQA",
  description:
    "The percentage of patients 18–85 years of age who had a diagnosis of hypertension and " +
    "whose most recent blood pressure was adequately controlled " +
    "(systolic < 140 mmHg and diastolic < 90 mmHg). " +
    "Uncontrolled hypertension is a major risk factor for heart disease, stroke, and kidney disease.",
  measurementPeriod: { anchor: "calendar_year" },
  denominatorCriteria: [
    "Age 18–85 as of December 31 of the measurement year",
    "Diagnosis of essential hypertension with onset prior to or during the first 6 months of the measurement year",
    "Continuous enrollment during the measurement year with no more than one gap of up to 45 days",
  ],
  numeratorCriteria: [
    "Most recent systolic blood pressure < 140 mmHg during the measurement year",
    "Most recent diastolic blood pressure < 90 mmHg during the measurement year",
    "Both systolic and diastolic criteria must be from the same or most recent BP reading",
  ],
  exclusionCriteria: [
    "Pregnancy during the measurement year",
    "End-stage renal disease (ESRD) or kidney transplant",
    "Hospice or palliative care enrollment",
    "Deceased during the measurement year",
    "65+ with frailty and advanced illness",
  ],
  valueSets: [
    { oid: "2.16.840.1.113883.3.464.1003.104.12.1011", name: "Essential Hypertension" },
    { oid: "2.16.840.1.113883.3.464.1003.198.12.1068", name: "Pregnancy" },
    { oid: "2.16.840.1.113883.3.464.1003.109.12.1028", name: "ESRD" },
    { oid: "2.16.840.1.113883.3.464.1003.109.12.1012", name: "Kidney Transplant" },
  ],
  ageRange: { min: 18, max: 85 },
  gender: "any",
  mipsWeight: 3,
  clinicalDomain: "Chronic Conditions",
};
