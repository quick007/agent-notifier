export {
  bytesToUtf8,
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
} from "../dist/index.js";

export function canonicalBytes(value: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(Object.fromEntries(Object.entries(value).sort())));
}
