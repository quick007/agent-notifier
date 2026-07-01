import { AppError } from "./http";

const plaintextKeys = new Set([
  "title",
  "body",
  "sensitive",
  "reply",
  "approvalText",
  "decision",
  "note",
  "actionLabel",
  "riskText",
  "prompt",
  "duplicateHash",
  "plaintextHash",
  "titleHash",
  "bodyHash",
  "titleBodyHash",
]);

type JsonObject = Record<string, unknown>;

export function rejectPlaintextContent(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectPlaintextContent(item, `${path}[${index}]`));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (plaintextKeys.has(key)) {
      throw new AppError(400, "plaintext_not_allowed", `Plaintext content field ${path}.${key} is not allowed.`);
    }
    rejectPlaintextContent(child, `${path}.${key}`);
  }
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
