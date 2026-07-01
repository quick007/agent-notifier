import { toBase64Url } from "./base64url.js";
import { asUint8Array, type ByteSource, type OwnedBytes } from "./bytes.js";
import { getSubtleCrypto } from "./webcrypto.js";

export async function sha256(source: ByteSource): Promise<OwnedBytes> {
  const digest = await getSubtleCrypto().digest("SHA-256", asUint8Array(source));
  return new Uint8Array(digest);
}

export async function sha256Base64Url(source: ByteSource): Promise<string> {
  return toBase64Url(await sha256(source));
}
