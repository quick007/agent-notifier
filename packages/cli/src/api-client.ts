import type { MessageSubmissionEnvelope, SenderKind } from "@agent-notifier/protocol";
import { hc } from "hono/client";
import type { Hono } from "hono";

interface JsonEndpoint<Input, Output, Status extends number> {
  input: Input;
  output: Output;
  outputFormat: "json";
  status: Status;
}

interface ClientResponseJson<Output> {
  ok: boolean;
  status: number;
  json(): Promise<Output>;
}

interface ClientEndpoint<Input, Output> {
  $url(input: Input): URL;
  $get(input: Input): Promise<ClientResponseJson<Output>>;
  $post(input: Input): Promise<ClientResponseJson<Output>>;
}

interface SenderDraftJson {
  displayName: string;
  kind: SenderKind;
  appName?: string;
  machineLabel?: string;
  workspaceLabel?: string;
  encryptionPublicKey: string;
  signingPublicKey: string;
  capabilities?: Record<string, unknown>;
}

interface PairingSessionJson {
  sessionId: string;
  expiresAt: string;
  status: "pending" | "claimed";
}

interface PairingStatusJson {
  status: "not_found" | "expired" | "paired" | "claimed" | "pending";
  expiresAt?: string;
  senderId?: string;
  recipientId?: string;
  sender?: SenderDraftJson;
  devices?: Array<{ deviceId: string; encryptionPublicKey: string; signingPublicKey: string }>;
}

interface SenderTargetsJson {
  senderId: string;
  recipientId: string;
  devices: Array<{ deviceId: string; encryptionPublicKey: string; signingPublicKey: string }>;
}

interface MessageStateJson {
  messageId: string;
  state: string;
}

type ApiSchema = {
  "/api/pairing/email/start": {
    $post: JsonEndpoint<{ json: { email: string; sender: SenderDraftJson } }, PairingSessionJson, 202>;
  };
  "/api/pairing/code/claim": {
    $post: JsonEndpoint<{ json: { code: string; secret: string; sender: SenderDraftJson } }, PairingSessionJson, 200>;
  };
  "/api/pairing/:sessionId/status": {
    $get: JsonEndpoint<{ param: { sessionId: string }; query: { secret?: string } }, PairingStatusJson, 200>;
  };
  "/api/senders/targets": {
    $get: JsonEndpoint<Record<string, never>, SenderTargetsJson, 200>;
  };
  "/api/senders/messages": {
    $post: JsonEndpoint<{ json: MessageSubmissionEnvelope }, MessageStateJson, 202>;
  };
  "/api/senders/messages/:messageId/status": {
    $get: JsonEndpoint<{ param: { messageId: string } }, Record<string, unknown>, 200>;
  };
  "/api/senders/messages/:messageId/response": {
    $get: JsonEndpoint<{ param: { messageId: string } }, Record<string, unknown>, 200>;
  };
};

type EmptyEnv = {};

export type AgentNotifierApiType = Hono<EmptyEnv, ApiSchema, "/">;
export type { MessageStateJson, PairingSessionJson, PairingStatusJson, SenderDraftJson, SenderTargetsJson };

export interface AgentNotifierApiClient {
  api: {
    pairing: {
      email: { start: Pick<ClientEndpoint<{ json: { email: string; sender: SenderDraftJson } }, PairingSessionJson>, "$post"> };
      code: { claim: Pick<ClientEndpoint<{ json: { code: string; secret: string; sender: SenderDraftJson } }, PairingSessionJson>, "$post"> };
      ":sessionId": { status: Pick<ClientEndpoint<{ param: { sessionId: string }; query: { secret?: string } }, PairingStatusJson>, "$get" | "$url"> };
    };
    senders: {
      targets: Pick<ClientEndpoint<undefined, SenderTargetsJson>, "$get" | "$url">;
      messages: Pick<ClientEndpoint<undefined, MessageStateJson>, "$url"> & {
        $post(input: { json: MessageSubmissionEnvelope }): Promise<ClientResponseJson<MessageStateJson>>;
        ":messageId": {
          status: Pick<ClientEndpoint<{ param: { messageId: string } }, Record<string, unknown>>, "$get" | "$url">;
          response: Pick<ClientEndpoint<{ param: { messageId: string } }, Record<string, unknown>>, "$get" | "$url">;
        };
      };
    };
  };
}

export function createApiClient(apiUrl: string): AgentNotifierApiClient {
  return hc<AgentNotifierApiType>(apiUrl) as unknown as AgentNotifierApiClient;
}

export function endpointPath(url: URL): string {
  return `${url.pathname}${url.search}`;
}

export async function jsonOrThrow<T>(response: { ok: boolean; status: number; json(): Promise<T> }): Promise<T> {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${JSON.stringify(json)}`);
  }
  return json as T;
}
