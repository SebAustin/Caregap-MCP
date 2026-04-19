import type { MeasureSpec } from "../registry.js";

/**
 * HEDIS BCS-E — Breast Cancer Screening
 * Source: NCQA HEDIS MY 2024, CMS eCQM CMS125v12
 * TODO(spec-verify) — verify exact age range and value set OIDs against current HEDIS Technical Specifications
 */
export const bcsSpec: MeasureSpec = {
  id: "BCS-E",
  name: "Breast Cancer Screening",
  shortName: "BCS",
  version: "HEDIS MY 2024",
  steward: "NCQA",
  description:
    "The percentage of women 50–74 years of age who had a mammogram to screen for breast cancer " +
    "in the past two years. This measure identifies women who are overdue for breast cancer screening, " +
    "a critical preventive service with strong evidence for reducing mortality.",
  measurementPeriod: { anchor: "calendar_year" },
  denominatorCriteria: [
    "Female",
    "Age 50–74 as of December 31 of the measurement year",
    "Continuous enrollment during the measurement year with no more than one gap of up to 45 days",
  ],
  numeratorCriteria: [
    "One or more mammograms any time on or between October 1 two years prior to the measurement year " +
      "and December 31 of the measurement year",
  ],
  exclusionCriteria: [
    "Bilateral mastectomy or evidence of two unilateral mastectomies on different dates of service",
    "Hospice or palliative care enrollment",
    "Deceased during the measurement year",
    "65+ with frailty and advanced illness",
  ],
  valueSets: [
    { oid: "2.16.840.1.113883.3.464.1003.108.11.1047", name: "Mammography" },
    { oid: "2.16.840.1.113883.3.464.1003.198.12.1005", name: "Bilateral Mastectomy" },
    { oid: "2.16.840.1.113883.3.464.1003.198.12.1134", name: "Unilateral Mastectomy Left" },
    { oid: "2.16.840.1.113883.3.464.1003.198.12.1135", name: "Unilateral Mastectomy Right" },
    { oid: "2.16.840.1.113883.3.464.1003.1003", name: "Hospice Encounter" },
  ],
  ageRange: { min: 50, max: 74 },
  gender: "female",
  mipsWeight: 3,
  clinicalDomain: "Prevention / Screening",
};
