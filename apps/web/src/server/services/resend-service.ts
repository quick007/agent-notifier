import { renderSetupEmail } from "@agent-notifier/emails";

import { AppError } from "../http";

interface SendSetupEmailInput {
  readonly email: string;
  readonly senderDisplayName: string;
  readonly setupUrl: string;
  readonly expiresAt: string;
}

export async function sendSetupEmail(env: Env, input: SendSetupEmailInput): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.APP_PUBLIC_URL) {
    throw new AppError(503, "email_not_configured", "Setup email is not configured.");
  }

  const baseUrl = env.APP_PUBLIC_URL.replace(/\/$/, "");
  const email = renderSetupEmail({
    senderDisplayName: input.senderDisplayName,
    setupUrl: input.setupUrl,
    expiresAt: input.expiresAt,
    termsUrl: `${baseUrl}/terms`,
    privacyUrl: `${baseUrl}/privacy`,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: input.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    throw new AppError(502, "email_send_failed", "Setup email could not be sent.");
  }
}
