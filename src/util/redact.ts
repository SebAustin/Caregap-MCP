const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

const DOB_PATTERN =
  /\b(?:0[1-9]|1[0-2])[\/-](?:0[1-9]|[12]\d|3[01])[\/-](?:19|20)\d{2}\b/g;

const ISO_DOB_PATTERN =
  /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g;

const MRN_PATTERN = /\bMRN[:\s#]*\w+/gi;

const PHONE_PATTERN =
  /\(?\b\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

const REDACTED = "[REDACTED]";

export function redact(input: string): string {
  return input
    .replace(SSN_PATTERN, REDACTED)
    .replace(DOB_PATTERN, REDACTED)
    .replace(ISO_DOB_PATTERN, REDACTED)
    .replace(MRN_PATTERN, REDACTED)
    .replace(PHONE_PATTERN, REDACTED)
    .replace(EMAIL_PATTERN, REDACTED);
}
