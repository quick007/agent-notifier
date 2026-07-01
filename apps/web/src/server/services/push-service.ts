import { buildPushPayload, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";

export interface PushTarget {
  readonly deviceId: string;
  readonly pushSubscriptionJson: string | null;
}

export interface PushAttempt {
  readonly deviceId: string;
  readonly ok: boolean;
  readonly status?: number;
  readonly error?: string;
}

export function publicPushConfig(env: Env) {
  return {
    publicKey: env.VAPID_PUBLIC_KEY ?? null,
    configured: Boolean(env.VAPID_PUBLIC_KEY),
  };
}

export async function sendPushWakeups(env: Env, targets: PushTarget[], messageId: string): Promise<PushAttempt[]> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT) {
    return targets.map((target) => ({
      deviceId: target.deviceId,
      ok: false,
      error: "vapid_not_configured",
    }));
  }

  const vapid: VapidKeys = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  return Promise.all(targets.map((target) => sendOne(target, messageId, vapid)));
}

async function sendOne(target: PushTarget, messageId: string, vapid: VapidKeys): Promise<PushAttempt> {
  if (!target.pushSubscriptionJson) {
    return { deviceId: target.deviceId, ok: false, error: "push_not_registered" };
  }

  try {
    const subscription = JSON.parse(target.pushSubscriptionJson) as PushSubscription;
    const payload = await buildPushPayload(
      {
        data: JSON.stringify({ type: "message_available", messageId }),
        options: { ttl: 60 },
      },
      subscription,
      vapid,
    );
    const init: RequestInit = {
      method: payload.method,
      headers: cleanHeaders(payload.headers),
    };
    const body = normalizeBody(payload.body);
    if (body !== undefined) {
      init.body = body;
    }
    const response = await fetch(subscription.endpoint, init);

    return { deviceId: target.deviceId, ok: response.ok, status: response.status };
  } catch (error) {
    return {
      deviceId: target.deviceId,
      ok: false,
      error: error instanceof Error ? error.message : "push_failed",
    };
  }
}

function cleanHeaders(headers: Record<string, string | undefined>): Headers {
  const clean = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined) {
      clean.set(name, value);
    }
  }

  return clean;
}

function normalizeBody(body: BodyInit | Uint8Array | undefined): BodyInit | undefined {
  if (body instanceof Uint8Array) {
    const copy: Uint8Array<ArrayBuffer> = new Uint8Array(body.byteLength);
    copy.set(body);
    return copy.buffer;
  }

  return body;
}
