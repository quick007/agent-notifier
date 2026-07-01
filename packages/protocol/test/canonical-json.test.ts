import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  DOMAINS,
  SIGNED_REQUEST_HEADERS,
  canonicalRequestBytes,
  canonicalJson,
  canonicalRequestText,
  canonicalSigningBytes,
  canonicalSigningText,
  assertKnownCriticalFields,
  withSchemaVersion,
} from "../dist/index.js";

test("canonicalJson sorts object keys recursively", () => {
  const value = {
    z: false,
    a: { d: [3, "x"], c: null },
    b: 2,
  };

  assert.equal(canonicalJson(value), '{"a":{"c":null,"d":[3,"x"]},"b":2,"z":false}');
});

test("canonicalJson rejects ambiguous or unsupported values", () => {
  assert.throws(() => canonicalJson({ bad: undefined }), /not canonical JSON/);
  assert.throws(() => canonicalJson({ bad: Number.NaN }), /non-canonical number/);
  assert.throws(() => canonicalJson({ bad: -0 }), /non-canonical number/);
  assert.throws(() => canonicalJson(new Date("2026-06-30T00:00:00.000Z")), /plain object/);
});

test("canonicalSigningText includes domain separation and schemaVersion", () => {
  const payload = withSchemaVersion({ messageId: "msg_test" });
  const signingText = canonicalSigningText({
    domain: DOMAINS.MESSAGE_V1,
    payload,
  });

  assert.equal(
    signingText,
    'agent-notifier/message/v1\n{"messageId":"msg_test","schemaVersion":1}',
  );
  assert.deepEqual(canonicalSigningBytes({ domain: DOMAINS.MESSAGE_V1, payload }), new TextEncoder().encode(signingText));
});

test("canonicalSigningText rejects missing schemaVersion", () => {
  assert.throws(
    () => canonicalSigningText({ domain: DOMAINS.MESSAGE_V1, payload: { messageId: "msg_test" } }),
    /schemaVersion 1/,
  );
});

test("canonicalRequestText covers signed request auth fields", () => {
  assert.equal(
    canonicalRequestText({
      method: "post",
      path: "/api/senders/messages",
      bodySha256: "abc",
      timestamp: "2026-07-01T00:00:00.000Z",
      nonce: "nonce",
      subjectType: "sender",
      subjectId: "snd_123",
    }),
    'agent-notifier/request/v1\n{"bodySha256":"abc","method":"POST","nonce":"nonce","path":"/api/senders/messages","schemaVersion":1,"subjectId":"snd_123","subjectType":"sender","timestamp":"2026-07-01T00:00:00.000Z"}',
  );
  assert.deepEqual(
    canonicalRequestBytes({
      method: "post",
      path: "/api/senders/messages",
      bodySha256: "abc",
      timestamp: "2026-07-01T00:00:00.000Z",
      nonce: "nonce",
      subjectType: "sender",
      subjectId: "snd_123",
    }),
    new TextEncoder().encode(
      'agent-notifier/request/v1\n{"bodySha256":"abc","method":"POST","nonce":"nonce","path":"/api/senders/messages","schemaVersion":1,"subjectId":"snd_123","subjectType":"sender","timestamp":"2026-07-01T00:00:00.000Z"}',
    ),
  );
});

test("signed request header names are a protocol-owned contract", () => {
  assert.deepEqual(SIGNED_REQUEST_HEADERS, {
    senderId: "x-agent-notifier-sender-id",
    deviceId: "x-agent-notifier-device-id",
    signature: "x-agent-notifier-signature",
    timestamp: "x-agent-notifier-timestamp",
    nonce: "x-agent-notifier-nonce",
  });
});

test("critical fields must be known and present", () => {
  assert.doesNotThrow(() => {
    assertKnownCriticalFields(
      { schemaVersion: 1, critical: ["mustUnderstand"], mustUnderstand: true },
      ["mustUnderstand"],
    );
  });

  assert.throws(
    () => assertKnownCriticalFields({ critical: ["futureField"], futureField: true }, ["knownField"]),
    /unknown critical field/,
  );
  assert.throws(
    () => assertKnownCriticalFields({ critical: ["knownField"] }, ["knownField"]),
    /missing field/,
  );
});
