import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  bytesToUtf8,
  canonicalBytes,
  exportPrivateKeyPkcs8,
  exportPublicKeySpki,
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  importEncryptionPrivateKey,
  importEncryptionPublicKey,
  importSigningPrivateKey,
  openContentFromDeviceWrap,
  sealContentForDevices,
  sha256Base64Url,
  signP256Sha256,
  utf8ToBytes,
  verifyP256Sha256,
} from "./helpers.ts";

test("key generation, export, and import round-trip", async () => {
  const encryptionKeys = await generateEncryptionKeyPair({ extractable: true });
  const signingKeys = await generateSigningKeyPair({ extractable: true });
  const encryptionPublic = await exportPublicKeySpki(encryptionKeys.publicKey);
  const encryptionPrivate = await exportPrivateKeyPkcs8(encryptionKeys.privateKey);
  const signingPrivate = await exportPrivateKeyPkcs8(signingKeys.privateKey);
  const importedPublic = await importEncryptionPublicKey(encryptionPublic);
  const importedPrivate = await importEncryptionPrivateKey(encryptionPrivate, { extractable: true });
  const importedSigningPrivate = await importSigningPrivateKey(signingPrivate, { extractable: true });

  const sealed = await sealContentForDevices({
    plaintext: utf8ToBytes("round trip"),
    aad: canonicalBytes({ messageId: "msg_roundtrip", schemaVersion: 1 }),
    devices: [{ deviceId: "dev_roundtrip", publicKey: importedPublic }],
  });
  const opened = await openContentFromDeviceWrap(
    sealed,
    sealed.keyWraps[0],
    importedPrivate,
    canonicalBytes({ messageId: "msg_roundtrip", schemaVersion: 1 }),
  );

  assert.equal(bytesToUtf8(opened), "round trip");
  assert.equal(typeof await exportPublicKeySpki(signingKeys.publicKey), "string");
  assert.equal(await exportPrivateKeyPkcs8(importedPrivate), encryptionPrivate);
  assert.equal(await exportPrivateKeyPkcs8(importedSigningPrivate), signingPrivate);
});

test("identity private keys default to non-extractable", async () => {
  const encryptionKeys = await generateEncryptionKeyPair();
  const signingKeys = await generateSigningKeyPair();
  assert.equal(typeof await exportPublicKeySpki(encryptionKeys.publicKey), "string");
  assert.equal(typeof await exportPublicKeySpki(signingKeys.publicKey), "string");

  await assertNonExtractable(encryptionKeys.privateKey);
  await assertNonExtractable(signingKeys.privateKey);

  const exportableEncryption = await generateEncryptionKeyPair({ extractable: true });
  const exportableSigning = await generateSigningKeyPair({ extractable: true });
  const encryptionPrivate = await exportPrivateKeyPkcs8(exportableEncryption.privateKey);
  const signingPrivate = await exportPrivateKeyPkcs8(exportableSigning.privateKey);

  await assertNonExtractable(await importEncryptionPrivateKey(encryptionPrivate));
  await assertNonExtractable(await importSigningPrivateKey(signingPrivate));
});

test("sealed content decrypts only with matching AAD and rejects tampering", async () => {
  const recipient = await generateEncryptionKeyPair();
  const sender = await generateSigningKeyPair();
  const aad = canonicalBytes({ messageId: "msg_1", schemaVersion: 1 });
  const sealed = await sealContentForDevices({
    plaintext: utf8ToBytes("Chrome Web Store review complete"),
    aad,
    devices: [{ deviceId: "dev_1", publicKey: recipient.publicKey }],
  });
  const signature = await signP256Sha256(sender.privateKey, aad);

  assert.equal(sealed.contentAadHash, await sha256Base64Url(aad));
  assert.equal(await verifyP256Sha256(sender.publicKey, aad, signature), true);
  assert.equal(
    bytesToUtf8(await openContentFromDeviceWrap(sealed, sealed.keyWraps[0], recipient.privateKey, aad)),
    "Chrome Web Store review complete",
  );

  await assert.rejects(
    () => openContentFromDeviceWrap(sealed, sealed.keyWraps[0], recipient.privateKey, utf8ToBytes("wrong aad")),
    /AAD hash mismatch/,
  );
  await assert.rejects(
    () => openContentFromDeviceWrap({ ...sealed, ciphertext: `${sealed.ciphertext.slice(0, -1)}A` }, sealed.keyWraps[0], recipient.privateKey, aad),
  );
  await assert.rejects(
    () => openContentFromDeviceWrap(sealed, { ...sealed.keyWraps[0], wrapNonce: "8PHy8_T19vf4-fr7" }, recipient.privateKey, aad),
  );
  await assert.rejects(
    () => openContentFromDeviceWrap(sealed, { ...sealed.keyWraps[0], wrappedKey: `${sealed.keyWraps[0].wrappedKey.slice(0, -1)}A` }, recipient.privateKey, aad),
  );
});

async function assertNonExtractable(privateKey: CryptoKey): Promise<void> {
  await assert.rejects(
    () => exportPrivateKeyPkcs8(privateKey),
    (error) => error instanceof DOMException && error.name === "InvalidAccessException",
  );
}
