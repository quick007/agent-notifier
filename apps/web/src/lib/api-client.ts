import { hc } from "hono/client";

import type { AppType } from "../server/api-contract";

export function apiClient() {
  return hc<AppType>(sameOriginBase());
}

export function endpointPath(url: URL): string {
  return `${url.pathname}${url.search}`;
}

export async function jsonOrThrow<T>(response: { ok: boolean; status: number; json(): Promise<unknown> }): Promise<T> {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`API ${response.status}: ${JSON.stringify(json)}`);
  return json as T;
}

function sameOriginBase(): string {
  if (typeof window === "undefined") return "http://localhost";
  return window.location.origin;
}
