export async function sha256Base64Url(value: string): Promise<string> {
  return sha256BytesBase64Url(new TextEncoder().encode(value));
}

export async function sha256BytesBase64Url(bytes: Uint8Array): Promise<string> {
  const copy = copyToArrayBuffer(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);

  return bytesToBase64Url(new Uint8Array(digest));
}

export function randomSecret(bytes = 32): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);

  return bytesToBase64Url(values);
}

export function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);

  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index]! ^ right[index]!;
  }

  return diff === 0;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
