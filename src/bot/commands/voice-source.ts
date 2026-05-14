import {
  parseNameOnlyCommand,
  readCommandText,
} from "../parse.js";
import { buildCancelKeyboard } from "../buttons.js";
import { replyText } from "../reply.js";
import { runBotTask } from "../task.js";
import { createAdminOnly } from "./auth.js";
import type { CommandDeps } from "./types.js";

export function registerVoiceSourceCommands({
  bot,
  env,
  log,
  telegramAudioSource,
  uploadSessions,
  voiceSources,
}: Pick<
  CommandDeps,
  | "bot"
  | "env"
  | "log"
  | "telegramAudioSource"
  | "uploadSessions"
  | "voiceSources"
>) {
  const adminOnly = createAdminOnly(env, log);

  bot.command("va", adminOnly, async (ctx) => {
    const message = ctx.message;
    const text = readCommandText(ctx);

    if (!message || !text || !ctx.chat || !ctx.from) {
      return;
    }

    const voiceName = voiceSources.validateName(
      parseNameOnlyCommand({
        command: "va",
        text,
      }),
    );

    if (!voiceName) {
      await replyText(ctx, "用法：/va (音色名)");
      return;
    }

    const prompt = await replyText(
      ctx,
      `请发送“${voiceName}”的音频或视频文件。`,
      undefined,
      {
        reply_markup: buildCancelKeyboard(buildSessionKey(ctx.chat.id, ctx.from.id)),
      },
    );

    uploadSessions.start(ctx.chat.id, ctx.from.id, {
      commandMessageId: message.message_id,
      promptMessageId: prompt.message_id,
      voiceName,
    });
  });

  bot.command("vd", adminOnly, async (ctx) => {
    const text = readCommandText(ctx);

    if (!text) {
      return;
    }

    const voiceName = voiceSources.validateName(
      parseNameOnlyCommand({
        command: "vd",
        text,
      }),
    );

    if (!voiceName) {
      await replyText(ctx, "用法：/vd (音色名)");
      return;
    }

    const result = await runBotTask(
      ctx,
      log,
      {
        errorMessage: "删除声音源失败",
      },
      () => voiceSources.delete(voiceName),
    );

    if (!result.ok) {
      return;
    }

    await replyText(
      ctx,
      result.value.deleted
        ? `已删除声音源“${result.value.voiceName}”。`
        : `没有找到声音源“${result.value.voiceName}”。`,
    );
  });

  bot.callbackQuery(/^cancel:/, async (ctx) => {
    const sessionId = ctx.callbackQuery.data.slice("cancel:".length);
    const [chatIdText, userIdText] = sessionId.split(":");
    const chatId = Number(chatIdText);
    const userId = Number(userIdText);

    if (!Number.isFinite(chatId) || !Number.isFinite(userId)) {
      await ctx.answerCallbackQuery();
      return;
    }

    const session = uploadSessions.cancel(chatId, userId);

    if (ctx.callbackQuery.message) {
      await ctx.editMessageReplyMarkup();
    }

    await ctx.answerCallbackQuery(session ? "已取消" : "没有可取消的内容");
  });

  bot.on("message", async (ctx, next) => {
    const message = ctx.message;

    if (!ctx.chat || !ctx.from || !message) {
      await next();
      return;
    }

    const session = uploadSessions.read(ctx.chat.id, ctx.from.id, message);

    if (!session || !telegramAudioSource.readUpload(message)) {
      await next();
      return;
    }

    const result = await runBotTask(
      ctx,
      log,
      {
        errorMessage: "保存声音源失败",
        react: {
          error: "👀",
          success: "👍",
        },
      },
      async () => {
        const upload = await telegramAudioSource.download(message);
        return voiceSources.save(session.voiceName, upload);
      },
    );

    if (!result.ok) {
      return;
    }

    uploadSessions.finish(ctx.chat.id, ctx.from.id);
    await replyText(
      ctx,
      `${result.value.replacedExisting ? "已更新" : "已保存"}声音源“${result.value.voiceName}”。`,
    );
  });
}

function buildSessionKey(chatId: number, userId: number) {
  return `${chatId}:${userId}`;
}
