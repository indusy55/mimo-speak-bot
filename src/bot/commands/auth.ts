import type { Context } from "grammy";
import type { Env } from "../../core/env.js";
import type { Log } from "../../core/log.js";
import { replyText } from "../reply.js";

export const createAdminOnly =
  (env: Pick<Env, "ADMIN_IDS">, log: Log) =>
  async (ctx: Context, next: () => Promise<void>) => {
    if (env.ADMIN_IDS.length === 0) {
      await next();
      return;
    }

    if (ctx.from && env.ADMIN_IDS.includes(ctx.from.id)) {
      await next();
      return;
    }

    log.warn(
      {
        fromId: ctx.from?.id,
      },
      "blocked admin-only command",
    );
    await replyText(ctx, "Permission denied.");
  };
