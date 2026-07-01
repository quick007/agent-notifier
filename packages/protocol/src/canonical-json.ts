export type CanonicalJsonPrimitive = null | boolean | number | string;

export type CanonicalJsonValue =
  | CanonicalJsonPrimitive
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

export function canonicalJson(value: unknown): string {
  return serializeCanonical(value, "$");
}

export function assertAllowedObjectKeys(
  value: unknown,
  allowedKeys: readonly string[],
  label = "payload",
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) {
    throw new TypeError(`${label} must be a plain object`);
  }

  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new TypeError(`${label} contains unknown field '${key}'`);
    }
  }
}

export function assertKnownCriticalFields(
  value: unknown,
  knownCriticalFields: readonly string[],
  path = "$",
): void {
  const known = new Set(knownCriticalFields);
  visitCriticalFields(value, known, path);
}

function serializeCanonical(value: unknown, path: string): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return serializeNumber(value, path);
    case "string":
      return JSON.stringify(value);
    case "object":
      return Array.isArray(value)
        ? serializeArray(value, path)
        : serializeObject(value, path);
    case "bigint":
    case "function":
    case "symbol":
    case "undefined":
      throw new TypeError(`${path} is not canonical JSON`);
  }

  throw new TypeError(`${path} is not canonical JSON`);
}

function serializeNumber(value: number, path: string): string {
  if (!Number.isFinite(value) || Object.is(value, -0)) {
    throw new TypeError(`${path} contains a non-canonical number`);
  }

  return JSON.stringify(value);
}

function serializeArray(value: readonly unknown[], path: string): string {
  const items = value.map((item, index) => serializeCanonical(item, `${path}[${index}]`));
  return `[${items.join(",")}]`;
}

function serializeObject(value: object, path: string): string {
  if (!isPlainRecord(value)) {
    throw new TypeError(`${path} must be a plain object`);
  }

  const keys = Object.keys(value).sort();
  const items = keys.map((key) => {
    const item = value[key];
    if (item === undefined) {
      throw new TypeError(`${path}.${key} is not canonical JSON`);
    }

    return `${JSON.stringify(key)}:${serializeCanonical(item, `${path}.${key}`)}`;
  });

  return `{${items.join(",")}}`;
}

function visitCriticalFields(value: unknown, known: Set<string>, path: string): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      visitCriticalFields(item, known, `${path}[${index}]`);
    }
    return;
  }

  if (!isPlainRecord(value)) {
    return;
  }

  const critical = value.critical;
  if (critical !== undefined) {
    if (!Array.isArray(critical) || critical.some((field) => typeof field !== "string")) {
      throw new TypeError(`${path}.critical must be a string array`);
    }

    for (const field of critical) {
      if (!known.has(field)) {
        throw new TypeError(`${path} contains unknown critical field '${field}'`);
      }
      if (!(field in value)) {
        throw new TypeError(`${path}.critical references missing field '${field}'`);
      }
    }
  }

  for (const key of Object.keys(value)) {
    visitCriticalFields(value[key], known, `${path}.${key}`);
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
