export interface SetupEmailInput {
  readonly senderDisplayName: string;
  readonly setupUrl: string;
  readonly expiresAt: string;
  readonly termsUrl: string;
  readonly privacyUrl: string;
}

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export function renderSetupEmail(input: SetupEmailInput): RenderedEmail {
  const sender = input.senderDisplayName.trim() || "An agent";
  const expiry = new Date(input.expiresAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
    timeZoneName: "short",
  });

  return {
    subject: `${sender} wants to send secure notifications`,
    html: renderHtml({ ...input, senderDisplayName: sender, expiry }),
    text: renderText({ ...input, senderDisplayName: sender, expiry }),
  };
}

function renderHtml(input: SetupEmailInput & { readonly expiry: string }): string {
  const sender = escapeHtml(input.senderDisplayName);
  const setupUrl = escapeHtml(input.setupUrl);
  const termsUrl = escapeHtml(input.termsUrl);
  const privacyUrl = escapeHtml(input.privacyUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f7f4;color:#191918;font-family:Inter,Arial,sans-serif;">
    <main style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <h1 style="font-size:24px;line-height:1.2;margin:0 0 16px;">Pair ${sender}</h1>
      <p style="font-size:16px;line-height:1.5;margin:0 0 16px;">
        ${sender} would like to send encrypted notifications and lightweight approval requests to this device.
      </p>
      <p style="font-size:16px;line-height:1.5;margin:0 0 24px;">
        Agent Notifier temporarily routes encrypted envelopes. The service cannot read message titles, bodies, replies, or approval details.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${setupUrl}" style="display:inline-block;background:#191918;color:#ffffff;text-decoration:none;border-radius:6px;padding:12px 18px;font-weight:700;">Open secure setup</a>
      </p>
      <p style="font-size:14px;line-height:1.5;margin:0 0 24px;color:#55524d;">This link expires ${escapeHtml(input.expiry)}.</p>
      <p style="font-size:13px;line-height:1.5;margin:0;color:#6c6861;">
        Review the <a href="${termsUrl}">Terms</a> and <a href="${privacyUrl}">Privacy Policy</a>.
      </p>
    </main>
  </body>
</html>`;
}

function renderText(input: SetupEmailInput & { readonly expiry: string }): string {
  return [
    `Pair ${input.senderDisplayName}`,
    "",
    `${input.senderDisplayName} would like to send encrypted notifications and lightweight approval requests to this device.`,
    "Agent Notifier temporarily routes encrypted envelopes. The service cannot read message titles, bodies, replies, or approval details.",
    "",
    `Open secure setup: ${input.setupUrl}`,
    `This link expires ${input.expiry}.`,
    "",
    `Terms: ${input.termsUrl}`,
    `Privacy Policy: ${input.privacyUrl}`,
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
