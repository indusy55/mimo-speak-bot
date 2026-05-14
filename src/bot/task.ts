import type { Context } from "grammy";
import type { Log } from "../core/log.js";
import { replyText } from "./reply.js";

type Queue = {
  run: <T>(key: number, task: () => Promise<T>) => Promise<T>;
};

export type BotTaskOptions = {
  errorMessage: string;
  queue?: Queue;
  react?: {
    error: Parameters<Context["react"]>[0];
    pending: Parameters<Context["react"]>[0];
    success: Parameters<Context["react"]>[0];
  };
  replyToMessageId?: number;
};

export type BotTaskResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
    };

export async function runBotTask<T>(
  ctx: Context,
  log: Log,
  options: BotTaskOptions,
  task: () => Promise<T>,
): Promise<BotTaskResult<T>> {
  try {
    if (options.react && ctx.chat) {
      await react(ctx, log, options.react.pending);
    }

    const run = () => task();
    const value =
      options.queue && ctx.chat?.type === "private"
        ? await options.queue.run(ctx.chat.id, run)
        : await run();

    if (options.react && ctx.chat) {
      await react(ctx, log, options.react.success);
    }

    return {
      ok: true,
      value,
    };
  } catch (error) {
    if (options.react && ctx.chat) {
      await react(ctx, log, options.react.error);
    }

    await handleTaskError(ctx, log, error, options);
    return {
      ok: false,
    };
  }
}

async function react(
  ctx: Context,
  log: Log,
  emoji: Parameters<Context["react"]>[0],
) {
  try {
    await ctx.react(emoji, {
      is_big: false,
    });
  } catch (error) {
    log.debug(
      {
        chatId: ctx.chat?.id,
        error,
        messageId: ctx.msgId,
      },
      "failed to react to message",
    );
  }
}

async function handleTaskError(
  ctx: Context,
  log: Log,
  error: unknown,
  options: BotTaskOptions,
) {
  log.error(
    {
      chatId: ctx.chat?.id,
      error,
      fromId: ctx.from?.id,
    },
    options.errorMessage,
  );

  if (!ctx.chat) {
    return;
  }

  await replyText(
    ctx,
    error instanceof Error ? error.message : options.errorMessage,
    options.replyToMessageId,
  );
}
