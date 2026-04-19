import { describe, it, expect } from "vitest";

process.env["MCP_MODE"] = "fixture";
process.env["PORT"] = "0";
process.env["MCP_API_KEYS"] = "";
process.env["LOG_LEVEL"] = "silent";
process.env["MCP_ALLOW_PRIVATE_FHIR"] = "false";

describe("FhirClient SSRF protection", () => {
  it("rejects localhost URLs when MCP_ALLOW_PRIVATE_FHIR is false", async () => {
    const { FhirClient } = await import("../src/fhir/client.js");
    expect(
      () =>
        new FhirClient({
          fhirServerUrl: "http://localhost:8080/fhir",
          fhirAccessToken: undefined,
          patientId: undefined,
        }),
    ).toThrow(/private\/loopback/);
  });

  it("rejects 10.x private IPs", async () => {
    const { FhirClient } = await import("../src/fhir/client.js");
    expect(
      () =>
        new FhirClient({
          fhirServerUrl: "http://10.0.0.1/fhir",
          fhirAccessToken: undefined,
          patientId: undefined,
        }),
    ).toThrow(/private\/loopback/);
  });

  it("rejects 192.168.x private IPs", async () => {
    const { FhirClient } = await import("../src/fhir/client.js");
    expect(
      () =>
        new FhirClient({
          fhirServerUrl: "http://192.168.1.1/fhir",
          fhirAccessToken: undefined,
          patientId: undefined,
        }),
    ).toThrow(/private\/loopback/);
  });

  it("rejects 127.0.0.1 loopback", async () => {
    const { FhirClient } = await import("../src/fhir/client.js");
    expect(
      () =>
        new FhirClient({
          fhirServerUrl: "http://127.0.0.1/fhir",
          fhirAccessToken: undefined,
          patientId: undefined,
        }),
    ).toThrow(/private\/loopback/);
  });

  it("accepts public URLs", async () => {
    const { FhirClient } = await import("../src/fhir/client.js");
    expect(
      () =>
        new FhirClient({
          fhirServerUrl: "https://fhir.example.com/r4",
          fhirAccessToken: "token",
          patientId: "123",
        }),
    ).not.toThrow();
  });

  it("rejects non-http(s) protocols", async () => {
    const { FhirClient } = await import("../src/fhir/client.js");
    expect(
      () =>
        new FhirClient({
          fhirServerUrl: "ftp://fhir.example.com/r4",
          fhirAccessToken: undefined,
          patientId: undefined,
        }),
    ).toThrow(/http or https/);
  });

  it("rejects invalid URLs", async () => {
    const { FhirClient } = await import("../src/fhir/client.js");
    expect(
      () =>
        new FhirClient({
          fhirServerUrl: "not-a-url",
          fhirAccessToken: undefined,
          patientId: undefined,
        }),
    ).toThrow(/Invalid FHIR server URL/);
  });
});
