import { and, eq, inArray, lt, or } from "drizzle-orm";

import { requireDatabase } from "../../db/client";
import {
  authNonces,
  deliveryEvents,
  messageEnvelopes,
  messageKeyWraps,
  rateLimitBuckets,
  responseEnvelopes,
} from "../../db/schema";
import { newId, nowIso } from "../ids";

const QUEUE_RETENTION_DAYS = 14;
const EVENT_RETENTION_DAYS = 30;
const RATE_LIMIT_BUCKET_RETENTION_DAYS = 2;

export async function runRetention(env: Env, at = new Date()): Promise<void> {
  const db = requireDatabase(env);
  const now = at.toISOString();
  const queueCutoff = daysAgo(at, QUEUE_RETENTION_DAYS);
  const eventCutoff = daysAgo(at, EVENT_RETENTION_DAYS);
  const rateLimitCutoff = daysAgo(at, RATE_LIMIT_BUCKET_RETENTION_DAYS);

  const expired = await db
    .select()
    .from(messageEnvelopes)
    .where(and(lt(messageEnvelopes.expiresAt, now), lt(messageEnvelopes.createdAt, queueCutoff)))
    .all();

  await db
    .update(messageEnvelopes)
    .set({ state: "expired" })
    .where(and(
      lt(messageEnvelopes.expiresAt, now),
      or(
        eq(messageEnvelopes.state, "accepted"),
        and(
          eq(messageEnvelopes.state, "delivered"),
          inArray(messageEnvelopes.mode, ["request_reply", "request_approval"]),
        ),
      ),
    ))
    .run();

  for (const message of expired) {
    await db.delete(messageKeyWraps).where(eq(messageKeyWraps.messageId, message.id)).run();
    await db.delete(responseEnvelopes).where(eq(responseEnvelopes.messageId, message.id)).run();
    await db.insert(deliveryEvents).values({
      id: newId("evt"),
      messageId: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      event: "expired",
      createdAt: nowIso(),
    }).run();
  }

  await db.delete(messageEnvelopes).where(lt(messageEnvelopes.createdAt, queueCutoff)).run();
  await db.delete(deliveryEvents).where(lt(deliveryEvents.createdAt, eventCutoff)).run();
  await db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.updatedAt, rateLimitCutoff)).run();
  await db.delete(authNonces).where(lt(authNonces.expiresAt, now)).run();
}

function daysAgo(from: Date, days: number): string {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
