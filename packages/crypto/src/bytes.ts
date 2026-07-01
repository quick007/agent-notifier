export type ByteSource = BufferSource;
export type OwnedBytes = Uint8Array<ArrayBuffer>;

export function asUint8Array(source: ByteSource): OwnedBytes {
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }

  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

export function copyBytes(source: ByteSource): OwnedBytes {
  return asUint8Array(source).slice();
}

export function utf8ToBytes(value: string): OwnedBytes {
  return new TextEncoder().encode(value);
}

export function bytesToUtf8(value: ByteSource): string {
  return new TextDecoder().decode(asUint8Array(value));
}

export function concatBytes(...parts: readonly ByteSource[]): OwnedBytes {
  const totalLength = parts.reduce((sum, part) => sum + asUint8Array(part).byteLength, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    const bytes = asUint8Array(part);
    output.set(bytes, offset);
    offset += bytes.byteLength;
  }

  return output;
}
