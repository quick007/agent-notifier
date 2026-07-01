import { createRoute, z } from "@hono/zod-openapi";
import type { Schema } from "hono";

import {
  deviceAuth,
  deviceSignedRequestSecurity,
  errorResponses,
  jsonContent,
  jsonRequest,
  type OpenApiApp,
} from "../hono";
import {
  CodePairingClaimRequestSchema,
  CodePairingStartResponseSchema,
  PairingApproveRequestSchema,
  PairingApproveResponseSchema,
  PairingEmailStartRequestSchema,
  PairingSessionId,
  PairingSessionResponseSchema,
  PairingStatusResponseSchema,
} from "../schemas";
import {
  approvePairing,
  claimCodePairing,
  pairingStatus,
  startCodePairing,
  startEmailPairing,
} from "../services/pairing-service";

const params = z.object({ sessionId: PairingSessionId });
const secretQuery = z.object({ secret: z.string().optional() });

export function registerPairingRoutes<S extends Schema, BasePath extends string>(app: OpenApiApp<S, BasePath>) {
  return app
    .openapi(createRoute({
      method: "post",
      path: "/api/pairing/email/start",
      tags: ["Pairing"],
      operationId: "startEmailPairing",
      request: { body: jsonRequest(PairingEmailStartRequestSchema) },
      responses: { 202: jsonContent(PairingSessionResponseSchema, "Pairing email queued."), ...errorResponses },
    }), async (c) => c.json(await startEmailPairing(c.env, c.req.valid("json")), 202))
    .openapi(createRoute({
      method: "post",
      path: "/api/pairing/code/start",
      tags: ["Pairing"],
      operationId: "startCodePairing",
      responses: { 201: jsonContent(CodePairingStartResponseSchema, "Pairing code created."), ...errorResponses },
    }), async (c) => c.json(await startCodePairing(c.env), 201))
    .openapi(createRoute({
      method: "post",
      path: "/api/pairing/code/claim",
      tags: ["Pairing"],
      operationId: "claimCodePairing",
      request: { body: jsonRequest(CodePairingClaimRequestSchema) },
      responses: { 200: jsonContent(PairingSessionResponseSchema, "Pairing claimed."), ...errorResponses },
    }), async (c) => {
      const body = c.req.valid("json");
      return c.json(await claimCodePairing(c.env, body.code, body.secret, body.sender), 200);
    })
    .openapi(createRoute({
      method: "post",
      path: "/api/pairing/{sessionId}/approve",
      tags: ["Pairing"],
      operationId: "approvePairing",
      middleware: deviceAuth,
      security: deviceSignedRequestSecurity,
      request: { params, body: jsonRequest(PairingApproveRequestSchema) },
      responses: { 200: jsonContent(PairingApproveResponseSchema, "Pairing approved."), ...errorResponses },
    }), async (c) => {
      const auth = c.get("deviceAuth");
      return c.json(
        await approvePairing(c.env, c.req.valid("param").sessionId, auth.deviceId, auth.recipientId, c.req.valid("json").secret),
        200,
      );
    })
    .openapi(createRoute({
      method: "get",
      path: "/api/pairing/{sessionId}/status",
      tags: ["Pairing"],
      operationId: "getPairingStatus",
      request: { params, query: secretQuery },
      responses: { 200: jsonContent(PairingStatusResponseSchema, "Current pairing status."), ...errorResponses },
    }), async (c) => c.json(
      await pairingStatus(c.env, c.req.valid("param").sessionId, c.req.valid("query").secret),
      200,
    ));
}
