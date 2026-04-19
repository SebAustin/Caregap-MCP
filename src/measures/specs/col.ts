import type { MeasureSpec } from "../registry.js";

/**
 * HEDIS COL-E — Colorectal Cancer Screening
 * Source: NCQA HEDIS MY 2024, CMS eCQM CMS130v12
 * TODO(spec-verify) — verify screening modality lookback windows against current HEDIS Technical Specifications
 */
export const colSpec: MeasureSpec = {
  id: "COL-E",
  name: "Colorectal Cancer Screening",
  shortName: "COL",
  version: "HEDIS MY 2024",
  steward: "NCQA",
  description:
    "The percentage of adults 45–75 years of age who had appropriate screening for colorectal cancer. " +
    "Multiple screening modalities are accepted, each with different lookback windows. " +
    "Early detection through screening significantly reduces colorectal cancer mortality.",
  measurementPeriod: { anchor: "calendar_year" },
  denominatorCriteria: [
    "Age 45–75 as of December 31 of the measurement year",
    "Continuous enrollment during the measurement year with no more than one gap of up to 45 days",
  ],
  numeratorCriteria: [
    "Fecal occult blood test (FOBT) during the measurement year",
    "FIT-DNA test during the measurement year or the two years prior",
    "Flexible sigmoidoscopy during the measurement year or the four years prior",
    "Colonoscopy during the measurement year or the nine years prior",
    "CT colonography during the measurement year or the four years prior",
  ],
  exclusionCriteria: [
    "Colorectal cancer diagnosis",
    "Total colectomy",
    "Hospice or palliative care enrollment",
    "Deceased during the measurement year",
    "65+ with frailty and advanced illness",
  ],
  valueSets: [
    { oid: "2.16.840.1.113883.3.464.1003.108.12.1020", name: "Fecal Occult Blood Test (FOBT)" },
    { oid: "2.16.840.1.113883.3.464.1003.108.12.1039", name: "FIT DNA Testing" },
    { oid: "2.16.840.1.113883.3.464.1003.198.12.1010", name: "Flexible Sigmoidoscopy" },
    { oid: "2.16.840.1.113883.3.464.1003.108.12.1038", name: "Colonoscopy" },
    { oid: "2.16.840.1.113883.3.464.1003.108.12.1040", name: "CT Colonography" },
    { oid: "2.16.840.1.113883.3.464.1003.108.12.1001", name: "Malignant Neoplasm of Colon" },
    { oid: "2.16.840.1.113883.3.464.1003.198.12.1019", name: "Total Colectomy" },
  ],
  ageRange: { min: 45, max: 75 },
  gender: "any",
  mipsWeight: 3,
  clinicalDomain: "Prevention / Screening",
};
