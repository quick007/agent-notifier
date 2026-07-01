import { encryptAesGcm, decryptAesGcm, exportAesGcmKey, generateAesGcmKey, importAesGcmKey } from "./aes-gcm.js";
import { concatBytes, utf8ToBytes } from "./bytes.js";
import type { ByteSource, OwnedBytes } from "./bytes.js";
import { sha256, sha256Base64Url } from "./digest.js";
import { deriveAesGcmKeyFromSecret, deriveSharedSecret } from "./kdf.js";
import { exportPublicKeySpki, generateEncryptionKeyPair, importEncryptionPublicKey } from "./keys.js";

export interface DeviceEncryptionTarget {
  readonly deviceId: string;
  readonly publicKey: CryptoKey;
}

export interface DeviceKeyWrap {
  readonly schemaVersion: 1;
  readonly deviceId: string;
  readonly ephemeralPublicKey: string;
  readonly wrappedKey: string;
  readonly wrapNonce: string;
}

export interface EncryptedContent {
  readonly ciphertext: string;
  readonly contentNonce: string;
  readonly contentAadHash: string;
}

export interface SealedContent extends EncryptedContent {
  readonly keyWraps: readonly DeviceKeyWrap[];
}

export interface EncryptContentInput {
  readonly plaintext: ByteSource;
  readonly aad: ByteSource;
  readonly contentKey?: CryptoKey;
  readonly nonce?: ByteSource;
}

export interface WrapContentKeyInput {
  readonly contentKey: CryptoKey;
  readonly deviceId: string;
  readonly recipientPublicKey: CryptoKey;
  readonly aad: ByteSource;
  readonly ephemeralKeyPair?: CryptoKeyPair;
  readonly wrapNonce?: ByteSource;
}

export interface SealContentInput {
  readonly plaintext: ByteSource;
  readonly aad: ByteSource;
  readonly devices: readonly DeviceEncryptionTarget[];
}

const KEY_WRAP_INFO = utf8ToBytes("agent-notifier/key-wrap/v1");
const KEY_WRAP_SCHEMA_VERSION = 1;
const EMPTY_SALT = new Uint8Array();

export async function encryptContent(
  input: EncryptContentInput,
): Promise<EncryptedContent & { readonly contentKey: CryptoKey }> {
  const contentKey = input.contentKey ?? await generateAesGcmKey();
  const encrypted = await encryptAesGcm({
    key: contentKey,
    plaintext: input.plaintext,
    aad: input.aad,
    ...(input.nonce ? { nonce: input.nonce } : {}),
  });

  return {
    contentKey,
    ciphertext: encrypted.ciphertext,
    contentNonce: encrypted.nonce,
    contentAadHash: await sha256Base64Url(input.aad),
  };
}

export async function sealContentForDevices(input: SealContentInput): Promise<SealedContent> {
  if (input.devices.length === 0) {
    throw new TypeError("at least one device target is required");
  }

  const encrypted = await encryptContent(input);
  const keyWraps = await Promise.all(input.devices.map((device) => wrapContentKeyForDevice({
    contentKey: encrypted.contentKey,
    deviceId: device.deviceId,
    recipientPublicKey: device.publicKey,
    aad: input.aad,
  })));

  return {
    ciphertext: encrypted.ciphertext,
    contentNonce: encrypted.contentNonce,
    contentAadHash: encrypted.contentAadHash,
    keyWraps,
  };
}

export async function wrapContentKeyForDevice(input: WrapContentKeyInput): Promise<DeviceKeyWrap> {
  const ephemeral = input.ephemeralKeyPair ?? await generateEncryptionKeyPair();
  const wrappingKey = await deriveWrapKey(ephemeral.privateKey, input.recipientPublicKey, input.aad);
  const wrapped = await encryptAesGcm({
    key: wrappingKey,
    plaintext: await exportAesGcmKey(input.contentKey),
    aad: input.aad,
    ...(input.wrapNonce ? { nonce: input.wrapNonce } : {}),
  });

  return {
    schemaVersion: KEY_WRAP_SCHEMA_VERSION,
    deviceId: input.deviceId,
    ephemeralPublicKey: await exportPublicKeySpki(ephemeral.publicKey),
    wrappedKey: wrapped.ciphertext,
    wrapNonce: wrapped.nonce,
  };
}

export async function unwrapContentKeyFromDeviceWrap(
  wrap: DeviceKeyWrap,
  recipientPrivateKey: CryptoKey,
  aad: ByteSource,
): Promise<CryptoKey> {
  const ephemeralPublicKey = await importEncryptionPublicKey(wrap.ephemeralPublicKey);
  const wrappingKey = await deriveWrapKey(recipientPrivateKey, ephemeralPublicKey, aad);
  const rawContentKey = await decryptAesGcm({
    key: wrappingKey,
    ciphertext: wrap.wrappedKey,
    nonce: wrap.wrapNonce,
    aad,
  });

  return importAesGcmKey(rawContentKey);
}

export async function openContentFromDeviceWrap(
  sealed: EncryptedContent,
  wrap: DeviceKeyWrap,
  recipientPrivateKey: CryptoKey,
  aad: ByteSource,
): Promise<OwnedBytes> {
  const expectedAadHash = await sha256Base64Url(aad);
  if (expectedAadHash !== sealed.contentAadHash) {
    throw new Error("content AAD hash mismatch");
  }

  const contentKey = await unwrapContentKeyFromDeviceWrap(wrap, recipientPrivateKey, aad);
  return decryptAesGcm({
    key: contentKey,
    ciphertext: sealed.ciphertext,
    nonce: sealed.contentNonce,
    aad,
  });
}

async function deriveWrapKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  aad: ByteSource,
): Promise<CryptoKey> {
  const sharedSecret = await deriveSharedSecret(privateKey, publicKey);
  const aadHash = await sha256(aad);
  const info = concatBytes(KEY_WRAP_INFO, utf8ToBytes("\n"), aadHash);

  return deriveAesGcmKeyFromSecret({
    sharedSecret,
    salt: EMPTY_SALT,
    info,
  });
}
