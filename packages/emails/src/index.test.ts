import { describe, expect, it } from "vite-plus/test";

import { renderSetupEmail } from "./index";

describe("renderSetupEmail", () => {
  it("formats setup expiry with readable UTC output", () => {
    const email = renderSetupEmail({
      senderDisplayName: "Codex",
      setupUrl: "https://notify.example/setup/pair/pair_123?secret=secret",
      expiresAt: "2026-07-01T00:30:00.000Z",
      termsUrl: "https://notify.example/terms",
      privacyUrl: "https://notify.example/privacy",
    });

    expect(email.text).toContain("This link expires Jul 1, 2026");
    expect(email.text).toContain("UTC");
    expect(email.html).toContain("This link expires Jul 1, 2026");
    expect(email.html).toContain("UTC");
  });
});
