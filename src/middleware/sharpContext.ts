import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";
import { logger } from "../util/logger.js";

export const SHARP_HEADERS = {
  fhirServerUrl: "x-fhir-server-url",
  fhirAccessToken: "x-fhir-access-token",
  patientId: "x-patient-id",
} as const;

export interface FhirContext {
  fhirServerUrl: string;
  fhirAccessToken: string | undefined;
  patientId: string | undefined;
}

export function getFhirContext(req: Request): FhirContext | null {
  const fhirServerUrl = req.headers[SHARP_HEADERS.fhirServerUrl];
  if (typeof fhirServerUrl !== "string" || !fhirServerUrl) return null;

  const fhirAccessToken =
    (req.headers[SHARP_HEADERS.fhirAccessToken] as string | undefined) ??
    undefined;
  const patientId =
    (req.headers[SHARP_HEADERS.patientId] as string | undefined) ?? undefined;

  return { fhirServerUrl, fhirAccessToken, patientId };
}

export function sharpContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (config.MCP_MODE === "fixture") {
    next();
    return;
  }

  const fhirServerUrl = req.headers[SHARP_HEADERS.fhirServerUrl];

  if (!fhirServerUrl) {
    logger.warn("Missing required FHIR context header: x-fhir-server-url");
    res.status(403).json({
      error: "Forbidden",
      message:
        "Missing required FHIR context headers. " +
        "This server requires X-FHIR-Server-URL to be set.",
    });
    return;
  }

  next();
}
