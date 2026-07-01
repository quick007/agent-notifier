import type { Route } from "../types";

/**
 * App links use real, history-API paths. React Router owns navigation, so this
 * is just the canonical string form of a route.
 */
export function href(route: Route) {
  return route;
}

export type PairingLink = {
  readonly sessionId: string;
  readonly secret?: string;
};

export function pairingLinkFromCurrentLocation(): PairingLink | null {
  return pairingLinkFromUrl(new URL(window.location.href));
}

export function routeFromUrl(url: URL): Route {
  return routeFromPath(url.pathname);
}

export function pairingLinkFromUrl(url: URL): PairingLink | null {
  return pairingLinkFromRouteText(`${url.pathname}${url.search}`);
}

function routeFromPath(pathname: string): Route {
  return routeFromText(pathname) ?? "/";
}

function routeFromText(text: string): Route | null {
  const [path] = text.split("?");
  const normalized = normalizePath(path ?? "/");

  if (isStaticRoute(normalized)) return normalized;
  if (normalized.startsWith("/message/")) return normalized as Route;
  if (normalized.startsWith("/senders/")) return normalized as Route;
  if (normalized.startsWith("/setup/pair/")) return normalized as Route;
  return null;
}

function pairingLinkFromRouteText(text: string): PairingLink | null {
  const [path, rawQuery = ""] = text.split("?");
  const normalized = normalizePath(path ?? "/");
  if (!normalized.startsWith("/setup/pair/")) return null;

  const sessionId = normalized.slice("/setup/pair/".length);
  if (!sessionId) return null;

  const params = new URLSearchParams(rawQuery);
  const secret = params.get("secret") ?? undefined;
  return {
    sessionId,
    ...(secret ? { secret } : {})
  };
}

function normalizePath(path: string): string {
  const decoded = decodeURIComponent(path || "/");
  if (decoded.length > 1 && decoded.endsWith("/")) return decoded.slice(0, -1);
  return decoded || "/";
}

function isStaticRoute(path: string): path is Route {
  return (
    path === "/" ||
    path === "/setup" ||
    path === "/setup/pair" ||
    path === "/inbox" ||
    path === "/saved" ||
    path === "/senders" ||
    path === "/settings" ||
    path === "/settings/notifications" ||
    path === "/privacy" ||
    path === "/terms" ||
    path === "/security"
  );
}
