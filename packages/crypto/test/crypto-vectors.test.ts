import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  decryptAesGcm,
  deriveAesGcmKeyFromSecret,
  deriveSharedSecret,
  encryptAesGcm,
  exportAesGcmKey,
  fromBase64Url,
  importAesGcmKey,
  importEncryptionPrivateKey,
  importEncryptionPublicKey,
  importSigningPublicKey,
  verifyP256Sha256,
} from "../dist/index.js";

const AES_VECTOR = {
  key: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8",
  nonce: "8PHy8_T19vf4-fr7",
  plaintext: "QWdlbnQgTm90aWZpZXIgdmVjdG9y",
  aad: "YWdlbnQtbm90aWZpZXIvbWVzc2FnZS92MQp7InNjaGVtYVZlcnNpb24iOjF9",
  ciphertext: "KGEmbgganBvrnpHz6zhCwHWCLa1Ko1aol0bpFIIuzuTRksBmxA",
};

const ECDH_VECTOR = {
  alicePrivate: "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg3gofkOzfL-MiiVVWLgje-TiwaNVZD63yrMGga4hMOtahRANCAAQma7LboL_AOwVtEbLbL2TApNXerE6lMfphbT3jdRAKzigxrmCsZ8hyXkw6FMGD8OM5StUwAaPbthJWeugF0QNo",
  bobPublic: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEE0j77c-A8AGKyN3eD7TKmgK3RsIGrJiNTDyIlMrGXWTU18nbOkim7VHIFldVtXy0oEeZg0dRwkTaSZQrmCVxmA",
  sharedSecret: "6B915AEEEMz5uAznWZuyqc-yq4sFvUnZ1b8LCmR8Tyw",
  hkdfSalt: "YWdlbnQtbm90aWZpZXItdGVzdC1zYWx0",
  hkdfInfo: "YWdlbnQtbm90aWZpZXIva2V5LXdyYXAvdjE",
  hkdfAesKey: "SrkE5BjJAc6PmHC53ZPDpGt70M_imGJc2_JPv-IjZMM",
};

const ECDSA_VECTOR = {
  publicKey: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEIM21RLbms-V_uhzfMBpxuTrhstNrV_NcJKvj7Zfm8L6pt2SrsE9WX2Su5MkrCiiX1lFNskeqnnizMctpKGnCUw",
  signedMessage: "YWdlbnQtbm90aWZpZXIvbWVzc2FnZS92MQp7Im1lc3NhZ2VJZCI6Im1zZ190ZXN0Iiwic2NoZW1hVmVyc2lvbiI6MX0",
  signature: "W_RlOHsBNL9wmDsK9kMlbSo9BZnobK1klG5sTqx0pGR6f9EbS5BebnlT80O8zDOiF2bj3EHq3Nbg61VhPimwXw",
};

test("AES-GCM encrypts and decrypts the fixed vector", async () => {
  const key = await importAesGcmKey(fromBase64Url(AES_VECTOR.key));
  const encrypted = await encryptAesGcm({
    key,
    plaintext: fromBase64Url(AES_VECTOR.plaintext),
    aad: fromBase64Url(AES_VECTOR.aad),
    nonce: fromBase64Url(AES_VECTOR.nonce),
  });

  assert.deepEqual(encrypted, {
    ciphertext: AES_VECTOR.ciphertext,
    nonce: AES_VECTOR.nonce,
  });
  assert.deepEqual(
    await decryptAesGcm({ key, ciphertext: encrypted.ciphertext, nonce: encrypted.nonce, aad: fromBase64Url(AES_VECTOR.aad) }),
    fromBase64Url(AES_VECTOR.plaintext),
  );
});

test("ECDH and HKDF derive the fixed key vector", async () => {
  const alicePrivate = await importEncryptionPrivateKey(ECDH_VECTOR.alicePrivate);
  const bobPublic = await importEncryptionPublicKey(ECDH_VECTOR.bobPublic);
  const sharedSecret = await deriveSharedSecret(alicePrivate, bobPublic);
  const derived = await deriveAesGcmKeyFromSecret({
    sharedSecret,
    salt: fromBase64Url(ECDH_VECTOR.hkdfSalt),
    info: fromBase64Url(ECDH_VECTOR.hkdfInfo),
  });

  assert.deepEqual(sharedSecret, fromBase64Url(ECDH_VECTOR.sharedSecret));
  assert.deepEqual(await exportAesGcmKey(derived), fromBase64Url(ECDH_VECTOR.hkdfAesKey));
});

test("ECDSA verifies the fixed signature vector and rejects tampering", async () => {
  const publicKey = await importSigningPublicKey(ECDSA_VECTOR.publicKey);
  const message = fromBase64Url(ECDSA_VECTOR.signedMessage);

  assert.equal(await verifyP256Sha256(publicKey, message, ECDSA_VECTOR.signature), true);
  assert.equal(await verifyP256Sha256(publicKey, new Uint8Array([...message, 0]), ECDSA_VECTOR.signature), false);
});
