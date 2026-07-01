import { canonicalJson, assertKnownCriticalFields } from "./canonical-json.js";
import { SCHEMA_VERSION } from "./domains.js";

export interface CanonicalSigningInput {
  readonly domain: string;
  readonly payload: Record<string, unknown>;
  readonly schemaVersion?: number;
  readonly knownCriticalFields?: readonly string[];
}

const DOMAIN_SEPARATOR = "\n";

export function canonicalSigningText(input: CanonicalSigningInput): string {
  const schemaVersion = input.schemaVersion ?? SCHEMA_VERSION;

  if (input.domain.length === 0 || input.domain.includes(DOMAIN_SEPARATOR)) {
    throw new TypeError("signing domain must be a non-empty single-line string");
  }

  if (input.payload.schemaVersion !== schemaVersion) {
    throw new TypeError(`signed payload must include schemaVersion ${schemaVersion}`);
  }

  if (input.knownCriticalFields) {
    assertKnownCriticalFields(input.payload, input.knownCriticalFields);
  }

  return `${input.domain}${DOMAIN_SEPARATOR}${canonicalJson(input.payload)}`;
}

export function canonicalSigningBytes(input: CanonicalSigningInput): Uint8Array {
  return new TextEncoder().encode(canonicalSigningText(input));
}

export function withSchemaVersion<T extends Record<string, unknown>>(
  payload: Omit<T, "schemaVersion">,
): Omit<T, "schemaVersion"> & { readonly schemaVersion: typeof SCHEMA_VERSION } {
  return {
    ...payload,
    schemaVersion: SCHEMA_VERSION,
  };
}
