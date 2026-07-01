export type IdPrefix =
  | "rcp"
  | "eml"
  | "dev"
  | "snd"
  | "pair"
  | "msg"
  | "wrap"
  | "rsp"
  | "evt"
  | "rl";

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addSecondsIso(seconds: number, from = Date.now()): string {
  return new Date(from + seconds * 1000).toISOString();
}

export function clampSeconds(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(value), max);
}
