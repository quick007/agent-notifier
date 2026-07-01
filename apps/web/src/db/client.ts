import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export function requireDatabase(env: Pick<Env, "DB">) {
  if (!env.DB) {
    throw new Error("D1 binding DB is not configured");
  }

  return drizzle(env.DB, { schema });
}

export type AppDatabase = ReturnType<typeof requireDatabase>;
