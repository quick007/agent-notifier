import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { sendSetupEmail } from "./resend-service";

describe("sendSetupEmail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the request public origin for setup and legal links", async () => {
    const requests: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(init ?? {});
      return new Response("{}", { status: 200 });
    });

    await sendSetupEmail({
      DB: {} as D1Database,
      RESEND_API_KEY: "resend-key",
      RESEND_FROM_EMAIL: "Agent Notifier <setup@example.com>",
    }, {
      email: "user@example.com",
      senderDisplayName: "Codex",
      setupUrl: "https://notify.example/setup/pair/pair_123?secret=secret",
      publicOrigin: "https://notify.example/some/path",
      expiresAt: "2026-07-01T00:30:00.000Z",
    });

    const body = JSON.parse(String(requests[0]?.body)) as { html: string; text: string };
    expect(body.html).toContain("https://notify.example/setup/pair/pair_123?secret=secret");
    expect(body.html).toContain("https://notify.example/terms");
    expect(body.html).toContain("https://notify.example/privacy");
    expect(body.text).toContain("This link expires Jul 1, 2026");
    expect(body.text).toContain("UTC");
    expect(body.text).toContain("Terms: https://notify.example/terms");
  });
});
