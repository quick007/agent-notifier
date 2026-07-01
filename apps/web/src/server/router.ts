import { Scalar } from "@scalar/hono-api-reference";
import type { Context } from "hono";

import { createOpenApiApp, handleError, plaintextJsonGuard, secureHeaders, type AppEnv } from "./hono";
import { registerDeviceRoutes } from "./routes/devices";
import { registerPairingRoutes } from "./routes/pairing";
import { registerSenderRoutes } from "./routes/senders";
import { registerSystemRoutes } from "./routes/system";

const scalarCdnUrl = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.62.1";
const apiVersion = "0.1.0";

const baseApp = createOpenApiApp();

baseApp.use("*", secureHeaders);
baseApp.use("/api/*", plaintextJsonGuard);

baseApp.doc31("/openapi.json", (c) => ({
  openapi: "3.1.0",
  info: {
    title: "Agent Notifier Worker API",
    version: apiVersion,
    summary: "Encrypted notifications and lightweight approvals for AI agents.",
    description: [
      "The Worker API stores and routes encrypted envelopes, sender/device metadata, and delivery state.",
      "Message titles, bodies, reply text, approval details, sensitivity flags, and plaintext hashes are not accepted.",
    ].join(" "),
  },
  servers: [
    { url: new URL(c.req.url).origin, description: "Current Worker origin." },
    { url: "http://localhost:5173", description: "Typical local Worker development origin." },
  ],
  tags: [
    { name: "System", description: "Health and public runtime metadata." },
    { name: "Pairing", description: "Email and code setup flows." },
    { name: "Devices", description: "Device delivery, push, response, and sender controls." },
    { name: "Senders", description: "Signed sender delivery and status routes." },
  ],
}));

baseApp.get("/docs", Scalar(scalarDocsConfig));
baseApp.get("/docs/", Scalar(scalarDocsConfig));
baseApp.get("/api/docs", (c) => c.redirect("/docs", 302));

const systemApp = registerSystemRoutes(baseApp);
const pairingApp = registerPairingRoutes(systemApp);
const deviceApp = registerDeviceRoutes(pairingApp);
export const app = registerSenderRoutes(deviceApp);

app.notFound((c) => c.json({ error: "not_found", message: "No API route is registered for this path." }, 404));
app.onError(handleError);

export function handleApiRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  return Promise.resolve(app.fetch(request, env, ctx));
}

export type AppType = typeof app;

function scalarDocsConfig(c: Context<AppEnv>) {
  const nonce = randomNonce();
  c.header("content-security-policy", scalarDocsCsp(nonce));
  c.header("referrer-policy", "no-referrer");
  c.header("x-content-type-options", "nosniff");
  c.header("x-frame-options", "DENY");
  c.header("x-permitted-cross-domain-policies", "none");

  return {
    url: "/openapi.json",
    cdn: scalarCdnUrl,
    nonce,
    agent: { disabled: true },
    hideTestRequestButton: true,
  };
}

function scalarDocsCsp(nonce: string): string {
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "connect-src 'self'",
    "font-src 'self' data: https://cdn.jsdelivr.net",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "manifest-src 'none'",
    "object-src 'none'",
    `script-src 'nonce-${nonce}' https://cdn.jsdelivr.net`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
  ].join("; ");
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
