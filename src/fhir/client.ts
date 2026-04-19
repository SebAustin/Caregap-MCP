import { config } from "../config.js";
import { logger } from "../util/logger.js";
import { McpToolError } from "../util/errors.js";
import type { FhirContext } from "../middleware/sharpContext.js";
import type { Bundle, FhirResource } from "./types.js";

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fd/i,
  /^fe80:/i,
  /^::1$/,
  /^localhost$/i,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_RANGES.some((re) => re.test(hostname));
}

function validateFhirUrl(baseUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new McpToolError(`Invalid FHIR server URL: ${baseUrl}`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new McpToolError(
      `FHIR server URL must use http or https: ${baseUrl}`,
    );
  }

  if (!config.MCP_ALLOW_PRIVATE_FHIR && isPrivateHost(parsed.hostname)) {
    throw new McpToolError(
      `FHIR server URL points to a private/loopback address: ${parsed.hostname}. ` +
        "Set MCP_ALLOW_PRIVATE_FHIR=true to allow this (local demo only).",
    );
  }

  return parsed;
}

function buildHeaders(ctx: FhirContext): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/fhir+json",
  };
  if (ctx.fhirAccessToken) {
    headers["Authorization"] = `Bearer ${ctx.fhirAccessToken}`;
  }
  return headers;
}

export class FhirClient {
  constructor(private readonly ctx: FhirContext) {
    validateFhirUrl(ctx.fhirServerUrl);
  }

  private url(path: string): string {
    const base = this.ctx.fhirServerUrl.replace(/\/+$/, "");
    const clean = path.startsWith("/") ? path.slice(1) : path;
    return `${base}/${clean}`;
  }

  async read<T extends FhirResource>(path: string): Promise<T | null> {
    const url = this.url(path);
    logger.debug(`FHIR read: ${path}`);

    const res = await fetch(url, { headers: buildHeaders(this.ctx) });
    if (res.status === 404) return null;

    if (!res.ok) {
      throw new McpToolError(
        `FHIR server returned ${res.status} for ${path}`,
      );
    }

    return (await res.json()) as T;
  }

  async search<T extends FhirResource>(
    resourceType: string,
    params: Record<string, string | string[]>,
  ): Promise<T[]> {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (Array.isArray(val)) {
        val.forEach((v) => searchParams.append(key, v));
      } else {
        searchParams.append(key, val);
      }
    }

    const path = `${resourceType}?${searchParams.toString()}`;
    logger.debug(`FHIR search: ${path}`);

    const results: T[] = [];
    let nextUrl: string | undefined = this.url(path);

    while (nextUrl) {
      const res = await fetch(nextUrl, { headers: buildHeaders(this.ctx) });
      if (!res.ok) {
        throw new McpToolError(
          `FHIR search failed with ${res.status} for ${resourceType}`,
        );
      }

      const bundle = (await res.json()) as Bundle<T>;
      if (bundle.entry) {
        for (const entry of bundle.entry) {
          if (entry.resource) results.push(entry.resource);
        }
      }

      const nextLink = bundle.link?.find((l) => l.relation === "next");
      nextUrl = nextLink?.url;
    }

    return results;
  }
}
