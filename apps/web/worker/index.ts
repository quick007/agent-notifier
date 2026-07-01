import { app } from "../src/server/router";
import { runRetention } from "../src/server/services/retention-service";

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runRetention(env));
  },
} satisfies ExportedHandler<Env>;
