import { createRoute } from "@hono/zod-openapi";
import type { Schema } from "hono";

import type { AppEnv, OpenApiApp } from "../hono";
import { errorResponses, jsonContent } from "../hono";
import { HealthResponseSchema, PushConfigResponseSchema } from "../schemas";
import { publicPushConfig } from "../services/push-service";

const healthRoute = createRoute({
  method: "get",
  path: "/api/health",
  tags: ["System"],
  operationId: "getHealth",
  responses: {
    200: jsonContent(HealthResponseSchema, "Worker API is reachable."),
    500: errorResponses[500],
  },
});

const pushConfigRoute = createRoute({
  method: "get",
  path: "/api/push/vapid-public-key",
  tags: ["System"],
  operationId: "getVapidPublicKey",
  responses: {
    200: jsonContent(PushConfigResponseSchema, "Public Web Push application server key."),
    ...errorResponses,
  },
});

export function registerSystemRoutes<S extends Schema, BasePath extends string>(app: OpenApiApp<S, BasePath>) {
  return app
    .openapi(healthRoute, (c) => c.json({ ok: true, service: "agent-notifier-web" } as const, 200))
    .openapi(pushConfigRoute, (c) => c.json(publicPushConfig(c.env), 200));
}

export type SystemAppEnv = AppEnv;
