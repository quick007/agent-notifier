import { fromBase64Url, toBase64Url } from "./base64url.js";
import { asUint8Array, type ByteSource } from "./bytes.js";
import { getSubtleCrypto } from "./webcrypto.js";

export async function signP256Sha256(privateKey: CryptoKey, data: ByteSource): Promise<string> {
  const signature = await getSubtleCrypto().sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    asUint8Array(data),
  );

  return toBase64Url(signature);
}

export async function verifyP256Sha256(
  publicKey: CryptoKey,
  data: ByteSource,
  signature: string | ByteSource,
): Promise<boolean> {
  const signatureBytes = typeof signature === "string" ? fromBase64Url(signature) : asUint8Array(signature);
  return getSubtleCrypto().verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    signatureBytes,
    asUint8Array(data),
  );
}
