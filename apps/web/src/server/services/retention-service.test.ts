import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { rateLimitBuckets } from "../../db/schema";
import { runRetention } from "./retention-service";

const mocks = vi.hoisted(() => ({
  requireDatabase: vi.fn(),
}));

vi.mock("../../db/client", () => ({
  requireDatabase: mocks.requireDatabase,
}));

describe("runRetention", () => {
  let db: FakeRetentionDatabase;

  beforeEach(() => {
    db = new FakeRetentionDatabase();
    mocks.requireDatabase.mockReturnValue(db);
  });

  it("prunes rate-limit buckets after the retention horizon", async () => {
    db.rateLimitRows.push(
      bucket("rl_old", "2026-06-28T23:59:59.999Z"),
      bucket("rl_cutoff", "2026-06-29T00:00:00.000Z"),
      bucket("rl_fresh", "2026-06-30T00:00:00.000Z"),
    );

    await runRetention(env(), new Date("2026-07-01T00:00:00.000Z"));

    expect(db.rateLimitRows.map((row) => row.id)).toEqual(["rl_cutoff", "rl_fresh"]);
  });
});

class FakeRetentionDatabase {
  readonly rateLimitRows: Array<typeof rateLimitBuckets.$inferInsert> = [];

  select() {
    return { from: () => query([]) };
  }

  update() {
    return { set: () => ({ where: () => ({ run: async () => d1Result(0) }) }) };
  }

  insert() {
    return { values: () => ({ run: async () => d1Result(0) }) };
  }

  delete(table: unknown) {
    return {
      where: (where: unknown) => ({
        run: async () => {
          if (table !== rateLimitBuckets) return d1Result(0);
          const cutoff = stringSqlParam(where);
          if (!cutoff) throw new Error("rate-limit cutoff was not provided");
          const originalLength = this.rateLimitRows.length;
          const retained = this.rateLimitRows.filter((row) => row.updatedAt >= cutoff);
          this.rateLimitRows.splice(0, this.rateLimitRows.length, ...retained);
          return d1Result(originalLength - retained.length);
        },
      }),
    };
  }
}

function query(rows: unknown[]) {
  const chain = {
    where: () => chain,
    all: async () => rows,
  };
  return chain;
}

function bucket(id: string, updatedAt: string): typeof rateLimitBuckets.$inferInsert {
  return {
    id,
    scope: "test.scope",
    scopeId: id,
    windowStart: updatedAt,
    count: 1,
    updatedAt,
  };
}

function stringSqlParam(value: unknown): string | undefined {
  const chunks = (value as { readonly queryChunks?: readonly unknown[] }).queryChunks ?? [];
  for (const chunk of chunks) {
    const param = chunk as { readonly value?: unknown };
    if (typeof param.value === "string") return param.value;
  }
  return undefined;
}

function d1Result(changes: number) {
  return { success: true, meta: { changes } };
}

function env(): Env {
  return { DB: {} as D1Database };
}
