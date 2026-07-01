import { describe, expect, it } from "vitest";

import { pairingLinkFromUrl, routeFromUrl } from "./routes";

describe("route parsing", () => {
  it("uses hash routes for normal in-app navigation", () => {
    const url = new URL("https://agent-notifier.test/#/inbox");

    expect(routeFromUrl(url)).toBe("/inbox");
  });

  it("supports direct setup email links", () => {
    const url = new URL("https://agent-notifier.test/setup/pair/pair_123?secret=s3cr3t");

    expect(routeFromUrl(url)).toBe("/setup/pair/pair_123");
    expect(pairingLinkFromUrl(url)).toEqual({
      sessionId: "pair_123",
      secret: "s3cr3t"
    });
  });

  it("supports hash setup links for local development", () => {
    const url = new URL("https://agent-notifier.test/#/setup/pair/pair_abc?secret=local");

    expect(routeFromUrl(url)).toBe("/setup/pair/pair_abc");
    expect(pairingLinkFromUrl(url)).toEqual({
      sessionId: "pair_abc",
      secret: "local"
    });
  });

  it("does not treat docs routes as app routes", () => {
    expect(routeFromUrl(new URL("https://agent-notifier.test/docs"))).toBe("/");
    expect(routeFromUrl(new URL("https://agent-notifier.test/openapi.json"))).toBe("/");
    expect(routeFromUrl(new URL("https://agent-notifier.test/api/docs"))).toBe("/");
  });
});
