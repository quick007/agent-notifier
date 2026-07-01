import {
  exportPrivateKeyPkcs8,
  exportPublicKeySpki,
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  randomBytes,
  toBase64Url,
} from "@agent-notifier/crypto";
import type { SenderKind, SenderRecord } from "./contracts.js";

const KEY_STORAGE_WARNING = "Sender private keys are stored in a local 0600 JSON file; OS keychain storage is not wired yet.";

export async function ensureSenderIdentity(
  sender: SenderRecord,
  displayName: string | undefined,
  kind: SenderKind | undefined,
): Promise<SenderRecord> {
  sender.displayName = displayName ?? sender.displayName;
  sender.kind = kind ?? sender.kind;

  if (sender.encryptionPublicKey && sender.signingPublicKey && sender.signingPrivateKeyPkcs8) {
    return sender;
  }

  const encryption = await generateEncryptionKeyPair({ extractable: true });
  const signing = await generateSigningKeyPair({ extractable: true });
  sender.encryptionPublicKey = await exportPublicKeySpki(encryption.publicKey);
  sender.signingPublicKey = await exportPublicKeySpki(signing.publicKey);
  sender.encryptionPrivateKeyPkcs8 = await exportPrivateKeyPkcs8(encryption.privateKey);
  sender.signingPrivateKeyPkcs8 = await exportPrivateKeyPkcs8(signing.privateKey);
  sender.keyStorageWarning = KEY_STORAGE_WARNING;
  return sender;
}

export function createLocalSender(displayName: string, kind: SenderKind): SenderRecord {
  return {
    id: localId("snd_local"),
    displayName,
    kind,
    createdAt: new Date().toISOString(),
  };
}

function localId(prefix: string): string {
  return `${prefix}_${toBase64Url(randomBytes(10)).slice(0, 14)}`;
}
