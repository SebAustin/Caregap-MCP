import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Bundle,
  FhirResource,
  Patient,
} from "../fhir/types.js";
import { logger } from "../util/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATIENTS_DIR = join(__dirname, "patients");

const FIXTURE_FILES = [
  "maria-gonzalez.json",
  "james-oconnor.json",
  "lin-chen.json",
  "alex-rivera.json",
];

interface FixtureStore {
  resources: FhirResource[];
  patients: Map<string, Patient>;
}

let store: FixtureStore | null = null;

function loadBundles(): FixtureStore {
  const resources: FhirResource[] = [];
  const patients = new Map<string, Patient>();

  for (const file of FIXTURE_FILES) {
    const path = join(PATIENTS_DIR, file);
    const raw = readFileSync(path, "utf-8");
    const bundle = JSON.parse(raw) as Bundle;

    if (bundle.entry) {
      for (const entry of bundle.entry) {
        if (!entry.resource) continue;
        resources.push(entry.resource);

        if (entry.resource.resourceType === "Patient" && entry.resource.id) {
          patients.set(entry.resource.id, entry.resource as Patient);
        }
      }
    }
  }

  logger.info(
    `Loaded ${resources.length} fixture resources (${patients.size} patients)`,
  );
  return { resources, patients };
}

export function getFixtureStore(): FixtureStore {
  if (!store) {
    store = loadBundles();
  }
  return store;
}

export function fixtureRead<T extends FhirResource>(
  path: string,
): T | null {
  const { resources } = getFixtureStore();
  const match = /^(\w+)\/(.+)$/.exec(path);
  if (!match) return null;

  const [, resourceType, id] = match;
  const found = resources.find(
    (r) => r.resourceType === resourceType && r.id === id,
  );
  return (found as T) ?? null;
}

export function fixtureSearch<T extends FhirResource>(
  resourceType: string,
  params: Record<string, string | string[]>,
): T[] {
  const { resources } = getFixtureStore();

  let filtered = resources.filter(
    (r) => r.resourceType === resourceType,
  ) as T[];

  const patientRef =
    typeof params["patient"] === "string"
      ? params["patient"]
      : Array.isArray(params["patient"])
        ? params["patient"][0]
        : undefined;

  const subjectRef =
    typeof params["subject"] === "string"
      ? params["subject"]
      : Array.isArray(params["subject"])
        ? params["subject"][0]
        : undefined;

  const targetPatient = patientRef ?? subjectRef;

  if (targetPatient) {
    filtered = filtered.filter((r) => {
      const res = r as FhirResource & {
        subject?: { reference?: string };
        patient?: { reference?: string };
        beneficiary?: { reference?: string };
      };
      const ref =
        res.subject?.reference ??
        res.patient?.reference ??
        res.beneficiary?.reference;
      return (
        ref === `Patient/${targetPatient}` || ref === targetPatient
      );
    });
  }

  return filtered;
}

export function getFixturePatientIds(): string[] {
  const { patients } = getFixtureStore();
  return Array.from(patients.keys());
}
