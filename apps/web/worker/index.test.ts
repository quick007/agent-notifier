import { hc } from "hono/client";
import { SIGNED_REQUEST_HEADERS } from "@agent-notifier/protocol";
import { describe, expect, it } from "vite-plus/test";

import type { AppType } from "@agent-notifier/web/api-contract";
import worker from "./index";

describe("worker", () => {
  it("responds to the health route", async () => {
    const response = await fetchWorker("/api/health");

    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "agent-notifier-web"
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("routes sender APIs through the backend router", async () => {
    const response = await fetchWorker("/api/senders/messages", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    await expect(response.json()).resolves.toMatchObject({
      error: "missing_signature",
    });
    expect(response.status).toBe(401);
  });

  it("returns structured errors for invalid JSON and invalid bodies", async () => {
    const invalidJson = await fetchWorker("/api/pairing/email/start", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json" },
    });
    await expect(invalidJson.json()).resolves.toMatchObject({ error: "invalid_json" });
    expect(invalidJson.status).toBe(400);

    const invalidBody = await fetchWorker("/api/pairing/email/start", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email" }),
      headers: { "content-type": "application/json" },
    });
    await expect(invalidBody.json()).resolves.toEqual({
      error: "invalid_body",
      message: "Request validation failed.",
    });
    expect(invalidBody.status).toBe(400);
  });

  it("serves the OpenAPI document from the Worker origin", async () => {
    const response = await fetchWorker("/openapi.json");
    const body = await response.json() as OpenApiTestDocument;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body.openapi).toBe("3.1.0");
    expect(body.servers[0]?.url).toBe("https://agent-notifier.test");
    expect(body.paths["/api/senders/messages"]?.post?.operationId).toBe("createMessage");
    expect(body.paths["/api/senders/targets"]?.get?.operationId).toBe("getSenderTargets");
    expect(body.paths["/api/devices/messages/{messageId}/respond"]?.post?.operationId).toBe("submitMessageResponse");
    expect(body.components.securitySchemes.senderSignedRequest?.name).toBe(SIGNED_REQUEST_HEADERS.signature);
    expect(body.components.securitySchemes.deviceSignedRequest?.name).toBe(SIGNED_REQUEST_HEADERS.signature);
    expect(body.paths["/api/senders/messages"]?.post?.security).toEqual([{ senderSignedRequest: [] }]);
    expect(body.paths["/api/devices/messages/{messageId}/respond"]?.post?.security).toEqual([{ deviceSignedRequest: [] }]);
  });

  it("serves Hono Scalar docs with a pinned script and the OpenAPI source", async () => {
    const response = await fetchWorker("/docs");
    const html = await response.text();
    const csp = response.headers.get("content-security-policy");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(csp).toContain("https://cdn.jsdelivr.net");
    expect(csp).toContain("script-src 'nonce-");
    expect(html).toContain("Scalar API Reference");
    expect(html).toContain("https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.62.1");
    expect(html).toContain('"url": "/openapi.json"');
    expect(html).toContain('"hideTestRequestButton": true');
  });

  it("redirects the API docs alias to Scalar docs", async () => {
    const response = await fetchWorker("/api/docs");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/docs");
  });

  it("exports Hono client route types for consumers", () => {
    const client = hc<AppType>("https://agent-notifier.test");
    type Client = ReturnType<typeof hc<AppType>>;
    type HealthGet = NonNullable<NonNullable<Client["api"]>["health"]>["$get"];
    type TargetsGet = NonNullable<NonNullable<NonNullable<Client["api"]>["senders"]>["targets"]>["$get"];

    const healthGet = client.api?.health?.$get as HealthGet | undefined;
    const targetsGet = client.api?.senders?.targets?.$get as TargetsGet | undefined;

    expect(typeof healthGet).toBe("function");
    expect(typeof targetsGet).toBe("function");
  });

  it("rejects plaintext fields before Hono strips unknown keys", async () => {
    const response = await fetchWorker("/api/pairing/email/start", {
      method: "POST",
      body: JSON.stringify({ title: "leak" }),
      headers: { "content-type": "application/json" },
    });

    await expect(response.json()).resolves.toMatchObject({
      error: "plaintext_not_allowed",
    });
    expect(response.status).toBe(400);
  });

  it("does not allow public device registration to bind an existing recipient", async () => {
    const response = await fetchWorker("/api/devices/register", {
      method: "POST",
      body: JSON.stringify({
        recipientId: "rcp_attack",
        device: {
          displayName: "Phone",
          encryptionPublicKey: "pub",
          signingPublicKey: "pub",
        },
      }),
      headers: { "content-type": "application/json" },
    });

    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_body",
    });
    expect(response.status).toBe(400);
  });
});

type OpenApiTestDocument = {
  readonly openapi: string;
  readonly servers: Array<{ readonly url: string }>;
  readonly paths: Record<string, Record<string, {
    readonly operationId: string;
    readonly security?: Array<Record<string, string[]>>;
  }>>;
  readonly components: {
    readonly securitySchemes: Record<string, { readonly name: string }>;
  };
};

function fetchWorker(path: string, init?: RequestInit): Promise<Response> {
  type WorkerRequest = Parameters<typeof worker.fetch>[0];
  const request = new Request(`https://agent-notifier.test${path}`, init) as WorkerRequest;

  return worker.fetch(request, {} as Env, {
    waitUntil() {
      return undefined;
    },
    passThroughOnException() {
      return undefined;
    },
  } as unknown as ExecutionContext);
}
