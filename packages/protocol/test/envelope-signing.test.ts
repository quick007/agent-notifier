import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  DOMAINS,
  messageContentAadBytes,
  messageEnvelopeSigningBytes,
  messageEnvelopeSigningText,
  responseEnvelopeSigningBytes,
  responseEnvelopeSigningText,
  isMessageMode,
  isResponseKind,
  type DeviceKeyWrap,
  type MessageEnvelopeSigningInput,
  type ResponseEnvelopeSigningInput,
  type ResponseSubmissionEnvelope,
  type ServerVisibleMessageMetadata,
} from "../dist/index.js";

const metadata: ServerVisibleMessageMetadata = {
  schemaVersion: 1,
  messageId: "msg_test",
  recipientId: "rcp_test",
  senderId: "snd_test",
  mode: "request_approval",
  createdAt: "2026-06-30T00:00:00.000Z",
  expiresAt: "2026-06-30T00:30:00.000Z",
};

const keyWraps: readonly DeviceKeyWrap[] = [
  keyWrap("dev_a", "wrapped_a"),
  keyWrap("dev_b", "wrapped_b"),
];

test("message envelope signing bytes cover metadata, ciphertext, nonces, AAD hash, and key wraps", async () => {
  const signingKeys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
    "verify",
  ]);
  const envelope: MessageEnvelopeSigningInput = {
    schemaVersion: 1,
    metadata,
    ciphertext: "ciphertext",
    contentNonce: "content_nonce",
    contentAadHash: "metadata_aad_hash",
    keyWraps,
  };
  const signature = await sign(signingKeys.privateKey, messageEnvelopeSigningBytes(envelope));

  assert.equal(await verify(signingKeys.publicKey, messageEnvelopeSigningBytes(envelope), signature), true);
  assert.equal(await verify(signingKeys.publicKey, messageEnvelopeSigningBytes({
    ...envelope,
    metadata: { ...metadata, senderId: "snd_tampered" },
  }), signature), false);
  assert.equal(await verify(signingKeys.publicKey, messageEnvelopeSigningBytes({
    ...envelope,
    keyWraps: [keyWraps[1], keyWraps[0]],
  }), signature), false);
  assert.equal(await verify(signingKeys.publicKey, messageEnvelopeSigningBytes({
    ...envelope,
    keyWraps: [{ ...keyWraps[0], wrappedKey: "wrapped_tampered" }, keyWraps[1]],
  }), signature), false);
  assert.ok(messageEnvelopeSigningText(envelope).startsWith(`${DOMAINS.MESSAGE_V1}\n`));
  assert.ok(messageContentAadBytes(metadata).byteLength > 0);
});

test("response signing bytes cover encrypted response fields only", async () => {
  const signingKeys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
    "verify",
  ]);
  const response: ResponseEnvelopeSigningInput = {
    schemaVersion: 1,
    responseId: "rsp_test",
    messageId: "msg_test",
    kind: "approval",
    expiresAt: "2026-06-30T00:30:00.000Z",
    ciphertext: "ciphertext",
    contentNonce: "content_nonce",
  };
  const signature = await sign(signingKeys.privateKey, responseEnvelopeSigningBytes(response));

  assert.equal(await verify(signingKeys.publicKey, responseEnvelopeSigningBytes(response), signature), true);
  assert.equal(await verify(signingKeys.publicKey, responseEnvelopeSigningBytes({
    ...response,
    ciphertext: "tampered",
  }), signature), false);
  assert.ok(responseEnvelopeSigningText(response).startsWith(`${DOMAINS.RESPONSE_V1}\n`));
});

test("response submission envelopes can be signed without including the signature field", async () => {
  const response: ResponseSubmissionEnvelope = {
    schemaVersion: 1,
    responseId: "rsp_signed",
    messageId: "msg_signed",
    kind: "reply",
    expiresAt: "2026-06-30T00:30:00.000Z",
    ciphertext: "ciphertext",
    contentNonce: "content_nonce",
    deviceSignature: "signature",
  };
  const signingBytes = responseEnvelopeSigningBytes(response);

  assert.deepEqual(signingBytes, responseEnvelopeSigningBytes({ ...response, deviceSignature: "changed" }));
  assert.equal(isMessageMode("request_reply"), true);
  assert.equal(isMessageMode("chat"), false);
  assert.equal(isResponseKind("approval"), true);
  assert.equal(isResponseKind("maybe"), false);
});

function keyWrap(deviceId: string, wrappedKey: string): DeviceKeyWrap {
  return {
    schemaVersion: 1,
    deviceId,
    ephemeralPublicKey: `ephemeral_${deviceId}`,
    wrappedKey,
    wrapNonce: `nonce_${deviceId}`,
  };
}

async function sign(privateKey: CryptoKey, data: BufferSource): Promise<ArrayBuffer> {
  return crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, data);
}

async function verify(publicKey: CryptoKey, data: BufferSource, signature: BufferSource): Promise<boolean> {
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, signature, data);
}
