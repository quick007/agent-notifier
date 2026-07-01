import { describe, expect, it } from "vite-plus/test";

import { pairingLinkFromUrl, routeFromUrl } from "./routes";

describe("route parsing", () => {
  it("uses real paths for normal in-app navigation", () => {
    const url = new URL("https://agent-notifier.test/inbox");

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

  it("ignores legacy fragment paths", () => {
    const url = new URL("https://agent-notifier.test/#/setup");

    expect(routeFromUrl(url)).toBe("/");
    expect(pairingLinkFromUrl(new URL("https://agent-notifier.test/#/setup/pair/pair_123?secret=s3cr3t"))).toBeNull();
  });

  it("does not use fragments as app route input on real paths", () => {
    expect(routeFromUrl(new URL("https://agent-notifier.test/setup#/inbox"))).toBe("/setup");
    expect(routeFromUrl(new URL("https://agent-notifier.test/setup#secret=s3cr3t"))).toBe("/setup");
    expect(pairingLinkFromUrl(new URL("https://agent-notifier.test/setup/pair/pair_123#?secret=s3cr3t"))).toEqual({
      sessionId: "pair_123"
    });
  });

  it("does not treat docs routes as app routes", () => {
    expect(routeFromUrl(new URL("https://agent-notifier.test/docs"))).toBe("/");
    expect(routeFromUrl(new URL("https://agent-notifier.test/openapi.json"))).toBe("/");
    expect(routeFromUrl(new URL("https://agent-notifier.test/api/docs"))).toBe("/");
  });
});
