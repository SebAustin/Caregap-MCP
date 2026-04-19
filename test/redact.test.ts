import { describe, it, expect } from "vitest";
import { redact } from "../src/util/redact.js";

describe("redact", () => {
  it("strips SSN patterns (XXX-XX-XXXX)", () => {
    const input = "Patient SSN is 123-45-6789 on file";
    expect(redact(input)).toBe("Patient SSN is [REDACTED] on file");
  });

  it("strips multiple SSNs", () => {
    const input = "SSN 123-45-6789 and 987-65-4321";
    expect(redact(input)).toBe("SSN [REDACTED] and [REDACTED]");
  });

  it("strips US date-format DOBs (MM/DD/YYYY)", () => {
    const input = "DOB: 01/15/1985";
    expect(redact(input)).toBe("DOB: [REDACTED]");
  });

  it("strips ISO date-format DOBs (YYYY-MM-DD)", () => {
    const input = "birthDate: 1985-01-15";
    expect(redact(input)).toBe("birthDate: [REDACTED]");
  });

  it("strips MRN patterns", () => {
    const input = "MRN: ABC123456 found in system";
    expect(redact(input)).toBe("[REDACTED] found in system");
  });

  it("strips MRN with hash format", () => {
    const input = "MRN#78901 is active";
    expect(redact(input)).toBe("[REDACTED] is active");
  });

  it("strips email addresses", () => {
    const input = "Contact at john.doe@example.com for info";
    expect(redact(input)).toBe("Contact at [REDACTED] for info");
  });

  it("strips phone numbers", () => {
    const input = "Call (555) 123-4567 for appointment";
    expect(redact(input)).toBe("Call [REDACTED] for appointment");
  });

  it("handles strings with no PHI", () => {
    const input = "Patient has open gap for BCS-E measure";
    expect(redact(input)).toBe("Patient has open gap for BCS-E measure");
  });

  it("strips multiple PHI types in one string", () => {
    const input =
      "Patient SSN 123-45-6789, DOB 03/15/1990, MRN: P12345, email test@example.com";
    const result = redact(input);
    expect(result).not.toContain("123-45-6789");
    expect(result).not.toContain("03/15/1990");
    expect(result).not.toContain("P12345");
    expect(result).not.toContain("test@example.com");
  });
});
