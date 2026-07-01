import { asUint8Array, type ByteSource, type OwnedBytes } from "./bytes.js";
import { getSubtleCrypto } from "./webcrypto.js";

export interface HkdfAesGcmInput {
  readonly sharedSecret: ByteSource;
  readonly salt: ByteSource;
  readonly info: ByteSource;
}

export async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<OwnedBytes> {
  const bits = await getSubtleCrypto().deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  return new Uint8Array(bits);
}

export async function deriveAesGcmKeyFromSecret(input: HkdfAesGcmInput): Promise<CryptoKey> {
  const hkdfKey = await getSubtleCrypto().importKey(
    "raw",
    asUint8Array(input.sharedSecret),
    "HKDF",
    false,
    ["deriveKey"],
  );

  return getSubtleCrypto().deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: asUint8Array(input.salt),
      info: asUint8Array(input.info),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}
