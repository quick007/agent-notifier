export function getWebCrypto(): Crypto {
  const crypto = globalThis.crypto;

  if (!crypto?.subtle || typeof crypto.getRandomValues !== "function") {
    throw new Error("WebCrypto is not available in this runtime");
  }

  return crypto;
}

export function getSubtleCrypto(): SubtleCrypto {
  return getWebCrypto().subtle;
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  if (!Number.isInteger(length) || length <= 0) {
    throw new TypeError("random byte length must be a positive integer");
  }

  const output = new Uint8Array(length);
  getWebCrypto().getRandomValues(output);
  return output;
}
