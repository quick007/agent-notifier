const DURATION_RE = /^(\d+)(ms|s|m|h|d)?$/u;

const UNIT_TO_MS = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

export function parseDuration(value: string, fallbackUnit: keyof typeof UNIT_TO_MS = "m"): number {
  const match = DURATION_RE.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? fallbackUnit) as keyof typeof UNIT_TO_MS;
  return amount * UNIT_TO_MS[unit];
}

export function fromNow(ms: number, now = new Date()): string {
  return new Date(now.getTime() + ms).toISOString();
}
