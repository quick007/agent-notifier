import { fromBase64Url, toBase64Url } from "./base64url.js";
import { asUint8Array, type ByteSource, type OwnedBytes } from "./bytes.js";
import { getSubtleCrypto, randomBytes } from "./webcrypto.js";

export interface AesGcmCiphertext {
  readonly ciphertext: string;
  readonly nonce: string;
}

export interface AesGcmEncryptInput {
  readonly key: CryptoKey;
  readonly plaintext: ByteSource;
  readonly aad?: ByteSource;
  readonly nonce?: ByteSource;
}

export interface AesGcmDecryptInput {
  readonly key: CryptoKey;
  readonly ciphertext: string | ByteSource;
  readonly nonce: string | ByteSource;
  readonly aad?: ByteSource;
}

const AES_GCM_NONCE_BYTES = 12;

export async function generateAesGcmKey(): Promise<CryptoKey> {
  return getSubtleCrypto().generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function importAesGcmKey(rawKey: ByteSource): Promise<CryptoKey> {
  return getSubtleCrypto().importKey("raw", asUint8Array(rawKey), "AES-GCM", true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function exportAesGcmKey(key: CryptoKey): Promise<OwnedBytes> {
  return new Uint8Array(await getSubtleCrypto().exportKey("raw", key));
}

export async function encryptAesGcm(input: AesGcmEncryptInput): Promise<AesGcmCiphertext> {
  const nonce = input.nonce ? asUint8Array(input.nonce) : randomBytes(AES_GCM_NONCE_BYTES);
  const ciphertext = await getSubtleCrypto().encrypt(
    aesGcmParams(nonce, input.aad),
    input.key,
    asUint8Array(input.plaintext),
  );

  return {
    ciphertext: toBase64Url(ciphertext),
    nonce: toBase64Url(nonce),
  };
}

export async function decryptAesGcm(input: AesGcmDecryptInput): Promise<OwnedBytes> {
  const ciphertext = decodeMaybeBase64Url(input.ciphertext);
  const nonce = decodeMaybeBase64Url(input.nonce);
  const plaintext = await getSubtleCrypto().decrypt(
    aesGcmParams(nonce, input.aad),
    input.key,
    ciphertext,
  );

  return new Uint8Array(plaintext);
}

function aesGcmParams(nonce: OwnedBytes, aad?: ByteSource): AesGcmParams {
  if (nonce.byteLength !== AES_GCM_NONCE_BYTES) {
    throw new TypeError("AES-GCM nonce must be 12 bytes");
  }

  return aad
    ? { name: "AES-GCM", iv: nonce, additionalData: asUint8Array(aad), tagLength: 128 }
    : { name: "AES-GCM", iv: nonce, tagLength: 128 };
}

function decodeMaybeBase64Url(value: string | ByteSource): OwnedBytes {
  return typeof value === "string" ? fromBase64Url(value) : asUint8Array(value);
}
