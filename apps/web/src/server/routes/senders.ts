import { createRoute, z } from "@hono/zod-openapi";
import type { Schema } from "hono";

import {
  errorResponses,
  jsonContent,
  jsonRequest,
  senderAuth,
  senderSignedRequestSecurity,
  type OpenApiApp,
} from "../hono";
import {
  AnyJsonResponseSchema,
  MessageId,
  MessageStateResponseSchema,
  MessageSubmissionRequestSchema,
  SenderTargetResponseSchema,
  toMessageSubmission,
} from "../schemas";
import {
  createMessage,
  messageEvents,
  messageResponse,
  messageStatus,
  senderTargets,
} from "../services/message-service";
import { enforceRateLimits, RATE_LIMIT_POLICIES } from "../services/rate-limit-service";

const messageParams = z.object({ messageId: MessageId });

export function registerSenderRoutes<S extends Schema, BasePath extends string>(app: OpenApiApp<S, BasePath>) {
  return app
    .openapi(createRoute({
      method: "get",
      path: "/api/senders/targets",
      tags: ["Senders"],
      operationId: "getSenderTargets",
      middleware: senderAuth,
      security: senderSignedRequestSecurity,
      responses: { 200: jsonContent(SenderTargetResponseSchema, "Active recipient device keys."), ...errorResponses },
    }), async (c) => {
      const auth = c.get("senderAuth");
      return c.json(await senderTargets(c.env, auth.senderId, auth.recipientId), 200);
    })
    .openapi(createRoute({
      method: "post",
      path: "/api/senders/messages",
      tags: ["Senders"],
      operationId: "createMessage",
      middleware: senderAuth,
      security: senderSignedRequestSecurity,
      request: { body: jsonRequest(MessageSubmissionRequestSchema) },
      responses: { 202: jsonContent(MessageStateResponseSchema, "Encrypted message accepted."), ...errorResponses },
    }), async (c) => {
      const auth = c.get("senderAuth");
      const message = toMessageSubmission(c.req.valid("json"));
      if (message.senderId !== auth.senderId) {
        return c.json({ error: "scope_mismatch", message: "Sender ID mismatch." }, 403);
      }
      if (message.recipientId !== auth.recipientId) {
        return c.json({ error: "scope_mismatch", message: "Recipient ID mismatch." }, 403);
      }
      await enforceRateLimits(c.env, [
        { policy: RATE_LIMIT_POLICIES.senderMessagesBySender, scopeId: auth.senderId },
        { policy: RATE_LIMIT_POLICIES.senderMessagesByRecipient, scopeId: auth.recipientId },
      ]);
      return c.json(await createMessage(c.env, c.executionCtx, message), 202);
    })
    .openapi(createRoute({
      method: "get",
      path: "/api/senders/messages/{messageId}/status",
      tags: ["Senders"],
      operationId: "getMessageStatus",
      middleware: senderAuth,
      security: senderSignedRequestSecurity,
      request: { params: messageParams },
      responses: { 200: jsonContent(AnyJsonResponseSchema, "Current message state."), ...errorResponses },
    }), async (c) => c.json(await messageStatus(c.env, c.get("senderAuth").senderId, c.req.valid("param").messageId), 200))
    .openapi(createRoute({
      method: "get",
      path: "/api/senders/messages/{messageId}/events",
      tags: ["Senders"],
      operationId: "listMessageEvents",
      middleware: senderAuth,
      security: senderSignedRequestSecurity,
      request: { params: messageParams },
      responses: { 200: jsonContent(AnyJsonResponseSchema, "Delivery events."), ...errorResponses },
    }), async (c) => c.json(await messageEvents(c.env, c.get("senderAuth").senderId, c.req.valid("param").messageId), 200))
    .openapi(createRoute({
      method: "get",
      path: "/api/senders/messages/{messageId}/response",
      tags: ["Senders"],
      operationId: "getMessageResponse",
      middleware: senderAuth,
      security: senderSignedRequestSecurity,
      request: { params: messageParams },
      responses: { 200: jsonContent(AnyJsonResponseSchema, "Encrypted response envelope."), ...errorResponses },
    }), async (c) => c.json(await messageResponse(c.env, c.get("senderAuth").senderId, c.req.valid("param").messageId), 200));
}
