import { bcsSpec } from "./specs/bcs.js";
import { colSpec } from "./specs/col.js";
import { cbpSpec } from "./specs/cbp.js";
import { hba1cSpec } from "./specs/hba1c.js";
import { imaSpec } from "./specs/imm.js";

export interface ValueSetRef {
  oid: string;
  name: string;
}

export interface MeasureSpec {
  id: string;
  name: string;
  shortName: string;
  version: string;
  steward: string;
  description: string;
  measurementPeriod: { anchor: "calendar_year" };
  denominatorCriteria: string[];
  numeratorCriteria: string[];
  exclusionCriteria: string[];
  valueSets: ValueSetRef[];
  ageRange?: { min: number; max: number };
  gender?: "male" | "female" | "any";
  mipsWeight?: number;
  clinicalDomain: string;
}

const ALL_SPECS: MeasureSpec[] = [bcsSpec, colSpec, cbpSpec, hba1cSpec, imaSpec];

const specMap = new Map<string, MeasureSpec>();
for (const spec of ALL_SPECS) {
  specMap.set(spec.id, spec);
}

export function getMeasureSpec(measureId: string): MeasureSpec | undefined {
  return specMap.get(measureId);
}

export function getAllMeasureIds(): string[] {
  return ALL_SPECS.map((s) => s.id);
}

export function getAllMeasureSpecs(): MeasureSpec[] {
  return [...ALL_SPECS];
}
