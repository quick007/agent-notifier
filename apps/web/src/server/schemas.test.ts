import { describe, expect, it } from "vite-plus/test";

import { MessageSubmissionRequestSchema, toMessageSubmission } from "./schemas";

describe("server message schemas", () => {
  it("requires and preserves sender-signed metadata.createdAt", () => {
    const createdAt = "2026-07-01T00:00:00.000Z";
    const input = {
      schemaVersion: 1,
      metadata: {
        schemaVersion: 1,
        messageId: "msg_test",
        recipientId: "rcp_test",
        senderId: "snd_test",
        mode: "notify",
        createdAt,
        expiresAt: "2026-07-01T00:30:00.000Z",
      },
      ciphertext: "ciphertext",
      contentNonce: "content_nonce",
      contentAadHash: "content_aad_hash",
      keyWraps: [{
        schemaVersion: 1,
        deviceId: "dev_test",
        ephemeralPublicKey: "ephemeral_public_key",
        wrappedKey: "wrapped_key",
        wrapNonce: "wrap_nonce",
      }],
      senderSignature: "sender_signature",
    };

    expect(toMessageSubmission(MessageSubmissionRequestSchema.parse(input)).createdAt).toBe(createdAt);
    expect(MessageSubmissionRequestSchema.safeParse({
      ...input,
      metadata: {
        ...input.metadata,
        createdAt: undefined,
      },
    }).success).toBe(false);
  });
});
