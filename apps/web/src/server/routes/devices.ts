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
  AnyJsonResponseSchema,
  DeviceSendersResponseSchema,
  DeviceRegistrationRequestSchema,
  IdResponseSchema,
  MessageId,
  MessageStateResponseSchema,
  PendingMessagesResponseSchema,
  PushSubscriptionUpdateRequestSchema,
  PushSubscriptionUpdateResponseSchema,
  ResponseSubmissionRequestSchema,
  SenderId,
  toDeviceRegistration,
} from "../schemas";
import {
  listSendersForDevice,
  markDelivered,
  pendingMessages,
  registerDevice,
  revokeSender,
  updatePushSubscription,
} from "../services/device-service";
import { submitResponse } from "../services/message-service";

const messageParams = z.object({ messageId: MessageId });
const senderParams = z.object({ senderId: SenderId });

export function registerDeviceRoutes<S extends Schema, BasePath extends string>(app: OpenApiApp<S, BasePath>) {
  return app
    .openapi(createRoute({
      method: "post",
      path: "/api/devices/register",
      tags: ["Devices"],
      operationId: "registerDevice",
      request: { body: jsonRequest(DeviceRegistrationRequestSchema) },
      responses: { 201: jsonContent(IdResponseSchema, "Device registered."), ...errorResponses },
    }), async (c) => c.json(await registerDevice(c.env, toDeviceRegistration(c.req.valid("json"))), 201))
    .openapi(createRoute({
      method: "post",
      path: "/api/devices/push-subscription",
      tags: ["Devices"],
      operationId: "updatePushSubscription",
      middleware: deviceAuth,
      security: deviceSignedRequestSecurity,
      request: { body: jsonRequest(PushSubscriptionUpdateRequestSchema) },
      responses: { 200: jsonContent(PushSubscriptionUpdateResponseSchema, "Push subscription updated."), ...errorResponses },
    }), async (c) => c.json(await updatePushSubscription(c.env, c.get("deviceAuth").deviceId, c.req.valid("json").pushSubscription), 200))
    .openapi(createRoute({
      method: "get",
      path: "/api/devices/messages/pending",
      tags: ["Devices"],
      operationId: "listPendingMessages",
      middleware: deviceAuth,
      security: deviceSignedRequestSecurity,
      responses: { 200: jsonContent(PendingMessagesResponseSchema, "Pending encrypted messages."), ...errorResponses },
    }), async (c) => c.json({ messages: await pendingMessages(c.env, c.get("deviceAuth").deviceId) }, 200))
    .openapi(createRoute({
      method: "post",
      path: "/api/devices/messages/{messageId}/delivered",
      tags: ["Devices"],
      operationId: "markMessageDelivered",
      middleware: deviceAuth,
      security: deviceSignedRequestSecurity,
      request: { params: messageParams },
      responses: { 200: jsonContent(MessageStateResponseSchema, "Message marked delivered."), ...errorResponses },
    }), async (c) => c.json(await markDelivered(c.env, c.get("deviceAuth").deviceId, c.req.valid("param").messageId), 200))
    .openapi(createRoute({
      method: "post",
      path: "/api/devices/messages/{messageId}/respond",
      tags: ["Devices"],
      operationId: "submitMessageResponse",
      middleware: deviceAuth,
      security: deviceSignedRequestSecurity,
      request: { params: messageParams, body: jsonRequest(ResponseSubmissionRequestSchema) },
      responses: { 201: jsonContent(AnyJsonResponseSchema, "Encrypted response stored."), ...errorResponses },
    }), async (c) => {
      const auth = c.get("deviceAuth");
      return c.json(await submitResponse(c.env, auth.deviceId, auth.recipientId, c.req.valid("param").messageId, c.req.valid("json")), 201);
    })
    .openapi(createRoute({
      method: "get",
      path: "/api/devices/senders",
      tags: ["Devices"],
      operationId: "listDeviceSenders",
      middleware: deviceAuth,
      security: deviceSignedRequestSecurity,
      responses: { 200: jsonContent(DeviceSendersResponseSchema, "Senders visible to this device."), ...errorResponses },
    }), async (c) => c.json(await listSendersForDevice(c.env, c.get("deviceAuth").deviceId), 200))
    .openapi(createRoute({
      method: "post",
      path: "/api/devices/senders/{senderId}/revoke",
      tags: ["Devices"],
      operationId: "revokeSender",
      middleware: deviceAuth,
      security: deviceSignedRequestSecurity,
      request: { params: senderParams },
      responses: { 200: jsonContent(AnyJsonResponseSchema, "Sender revoked."), ...errorResponses },
    }), async (c) => c.json(await revokeSender(c.env, c.req.valid("param").senderId, c.get("deviceAuth").recipientId), 200));
}
