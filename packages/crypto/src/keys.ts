import { fromBase64Url, toBase64Url } from "./base64url.js";
import { getSubtleCrypto } from "./webcrypto.js";

export interface GenerateKeyPairOptions {
  readonly extractable?: boolean;
}

export interface ImportPrivateKeyOptions {
  readonly extractable?: boolean;
}

const P256_ECDH = { name: "ECDH", namedCurve: "P-256" } as const;
const P256_ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;

export async function generateEncryptionKeyPair(
  options: GenerateKeyPairOptions = {},
): Promise<CryptoKeyPair> {
  return getSubtleCrypto().generateKey(P256_ECDH, options.extractable ?? false, [
    "deriveBits",
  ]) as Promise<CryptoKeyPair>;
}

export async function generateSigningKeyPair(
  options: GenerateKeyPairOptions = {},
): Promise<CryptoKeyPair> {
  return getSubtleCrypto().generateKey(P256_ECDSA, options.extractable ?? false, [
    "sign",
    "verify",
  ]) as Promise<CryptoKeyPair>;
}

export async function exportPublicKeySpki(publicKey: CryptoKey): Promise<string> {
  return toBase64Url(await getSubtleCrypto().exportKey("spki", publicKey));
}

export async function exportPrivateKeyPkcs8(privateKey: CryptoKey): Promise<string> {
  return toBase64Url(await getSubtleCrypto().exportKey("pkcs8", privateKey));
}

export async function importEncryptionPublicKey(spki: string): Promise<CryptoKey> {
  return getSubtleCrypto().importKey("spki", fromBase64Url(spki), P256_ECDH, true, []);
}

export async function importEncryptionPrivateKey(
  pkcs8: string,
  options: ImportPrivateKeyOptions = {},
): Promise<CryptoKey> {
  return getSubtleCrypto().importKey("pkcs8", fromBase64Url(pkcs8), P256_ECDH, options.extractable ?? false, [
    "deriveBits",
  ]);
}

export async function importSigningPublicKey(spki: string): Promise<CryptoKey> {
  return getSubtleCrypto().importKey("spki", fromBase64Url(spki), P256_ECDSA, true, [
    "verify",
  ]);
}

export async function importSigningPrivateKey(
  pkcs8: string,
  options: ImportPrivateKeyOptions = {},
): Promise<CryptoKey> {
  return getSubtleCrypto().importKey("pkcs8", fromBase64Url(pkcs8), P256_ECDSA, options.extractable ?? false, [
    "sign",
  ]);
}
