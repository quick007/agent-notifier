import { OpenAPIHono, type RouteConfig, type z } from "@hono/zod-openapi";
import { SIGNED_REQUEST_HEADERS } from "@agent-notifier/protocol";
import type { MiddlewareHandler, Schema } from "hono";

import { verifyDeviceRequest, verifySenderRequest, type DeviceAuth, type SenderAuth } from "./auth";
import { AppError, securityHeaders } from "./http";
import { ErrorSchema } from "./schemas";
import { rejectPlaintextContent } from "./validation";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    senderAuth: SenderAuth;
    deviceAuth: DeviceAuth;
  };
};

export type OpenApiApp<S extends Schema = {}, BasePath extends string = "/"> = OpenAPIHono<AppEnv, S, BasePath>;

export function createOpenApiApp() {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook(result, c) {
      if (result.success) return;
      return c.json({ error: "invalid_body", message: "Request validation failed." }, 400);
    },
  });
  app.openAPIRegistry.registerComponent("securitySchemes", "senderSignedRequest", {
    type: "apiKey",
    in: "header",
    name: SIGNED_REQUEST_HEADERS.signature,
    description: "ECDSA request signature. Also requires sender ID, timestamp, and nonce headers.",
  });
  app.openAPIRegistry.registerComponent("securitySchemes", "deviceSignedRequest", {
    type: "apiKey",
    in: "header",
    name: SIGNED_REQUEST_HEADERS.signature,
    description: "ECDSA request signature. Also requires device ID, timestamp, and nonce headers.",
  });
  return app;
}

export const secureHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (c.req.path === "/docs" || c.req.path === "/docs/") return;
  for (const [name, value] of Object.entries(securityHeaders)) c.header(name, value);
};

export const plaintextJsonGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!["POST", "PUT", "PATCH"].includes(c.req.method)) {
    await next();
    return;
  }
  const contentType = c.req.header("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("+json")) {
    await next();
    return;
  }
  const text = await c.req.raw.clone().text();
  if (text.trim().length === 0) {
    await next();
    return;
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AppError(400, "invalid_json", "Request body must be valid JSON.");
  }

  rejectPlaintextContent(value);
  await next();
};

export const senderSignedRequestSecurity: NonNullable<RouteConfig["security"]> = [{ senderSignedRequest: [] }];
export const deviceSignedRequestSecurity: NonNullable<RouteConfig["security"]> = [{ deviceSignedRequest: [] }];

export const senderAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("senderAuth", await verifySenderRequest(c.env, c.req.raw));
  await next();
};

export const deviceAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("deviceAuth", await verifyDeviceRequest(c.env, c.req.raw));
  await next();
};

export function handleError(error: Error, c: Parameters<Parameters<OpenAPIHono<AppEnv>["onError"]>[0]>[1]) {
  if (error instanceof AppError) {
    return c.json({
      error: error.code,
      message: error.message,
      ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
    }, error.status as 400);
  }
  console.error("Unhandled API error", error);
  return c.json({ error: "internal_error", message: "Something went wrong." }, 500);
}

export function jsonContent<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { "application/json": { schema } } };
}

export function jsonRequest<T extends z.ZodType>(schema: T) {
  return { required: true, content: { "application/json": { schema } } };
}

export const errorResponses = {
  400: jsonContent(ErrorSchema, "Invalid request."),
  401: jsonContent(ErrorSchema, "Signed request authentication failed."),
  403: jsonContent(ErrorSchema, "Authenticated subject is not allowed."),
  404: jsonContent(ErrorSchema, "Resource not found."),
  409: jsonContent(ErrorSchema, "Resource conflict."),
  429: jsonContent(ErrorSchema, "Rate limit exceeded."),
  500: jsonContent(ErrorSchema, "Unexpected server error."),
} satisfies RouteConfig["responses"];
