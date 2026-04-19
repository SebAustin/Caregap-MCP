import type { MeasureSpec } from "../registry.js";

/**
 * HEDIS IMA — Immunizations for Adolescents
 * Source: NCQA HEDIS MY 2024, CMS eCQM CMS117v12
 * TODO(spec-verify) — verify vaccine combinations and dose counts against current HEDIS Technical Specifications
 */
export const imaSpec: MeasureSpec = {
  id: "IMA",
  name: "Immunizations for Adolescents",
  shortName: "IMA",
  version: "HEDIS MY 2024",
  steward: "NCQA",
  description:
    "The percentage of adolescents 13 years of age who had the recommended immunizations by " +
    "their 13th birthday: one dose of meningococcal conjugate vaccine (MenACWY), one Tdap vaccine, " +
    "and the complete HPV vaccine series. This measure promotes adherence to the ACIP-recommended " +
    "adolescent immunization schedule.",
  measurementPeriod: { anchor: "calendar_year" },
  denominatorCriteria: [
    "Age 13 during the measurement year (turned 13 between January 1 and December 31)",
    "Continuous enrollment from the member's 12th birthday through their 13th birthday " +
      "with no more than one gap of up to 45 days",
  ],
  numeratorCriteria: [
    "At least one meningococcal conjugate vaccine (MenACWY) on or between the member's 11th and 13th birthdays",
    "At least one Tdap vaccine on or between the member's 10th and 13th birthdays",
    "At least two HPV vaccines on or between the member's 9th and 13th birthdays (if series started before age 15), " +
      "or three doses if started at age 15 or older",
  ],
  exclusionCriteria: [
    "Anaphylactic reaction to vaccine or component",
    "Encephalopathy within 7 days of prior pertussis vaccine (for Tdap)",
    "Hospice enrollment",
    "Deceased during the measurement year",
  ],
  valueSets: [
    { oid: "2.16.840.1.113883.3.464.1003.110.12.1025", name: "Meningococcal Vaccine (MenACWY)" },
    { oid: "2.16.840.1.113883.3.464.1003.110.12.1027", name: "Tdap Vaccine" },
    { oid: "2.16.840.1.113883.3.464.1003.110.12.1024", name: "HPV Vaccine" },
    { oid: "2.16.840.1.113883.3.464.1003.110.12.1026", name: "Anaphylactic Reaction to Vaccine" },
  ],
  ageRange: { min: 13, max: 13 },
  gender: "any",
  mipsWeight: 2,
  clinicalDomain: "Prevention / Immunization",
};
