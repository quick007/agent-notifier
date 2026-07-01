import { asUint8Array, type ByteSource, type OwnedBytes } from "./bytes.js";

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;

export function toBase64Url(source: ByteSource): string {
  const bytes = asUint8Array(source);
  let binary = "";

  for (let offset = 0; offset < bytes.byteLength; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function fromBase64Url(value: string): OwnedBytes {
  if (!BASE64URL_PATTERN.test(value) || value.length % 4 === 1) {
    throw new TypeError("invalid base64url value");
  }

  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
