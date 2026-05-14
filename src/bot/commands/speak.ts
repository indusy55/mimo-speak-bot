import type { Context } from "grammy";
import { presetVoices } from "../../tts/preset-voices.js";
import { defaultPresetVoiceId } from "../../tts/preset-voices.js";
import type { TtsService } from "../../tts/service.js";
import type { Log } from "../../core/log.js";
import type { ChatQueue } from "../queue.js";
import { buildVoiceSelectKeyboard } from "../buttons.js";
import {
  parseSpeakCommand,
  readCommandText,
  resolveSpeakText,
  type SpeakParams,
} from "../parse.js";
import { replySpeechAudio, replyText } from "../reply.js";
import { runBotTask } from "../task.js";
import type { CommandDeps } from "./types.js";

type SpeakKind = "clone" | "design" | "preset";

export function registerSpeakCommands({
  bot,
  log,
  queue,
  voiceSelectStore,
  tts,
}: Pick<
  CommandDeps,
  "bot" | "log" | "queue" | "tts" | "voiceSelectStore"
>) {
  bot.command("sp", async (ctx) => {
    await handleSpeakCommand({
      command: "sp",
      ctx,
      kind: "preset",
      log,
      queue,
      tts,
      usage: "用法：/sp (音色) [指令] {风格} 文本",
    });
  });

  bot.command("sc", async (ctx) => {
    await handleSpeakCommand({
      command: "sc",
      ctx,
      kind: "clone",
      log,
      queue,
      tts,
      usage: "用法：/sc (音色) [指令] {风格} 文本",
    });
  });

  bot.command("ss", async (ctx) => {
    await handleSelectSpeakCommand({
      ctx,
      log,
      usage: "用法：/ss 回复一条消息后选择音色",
      voiceSelectStore,
    });
  });

  bot.command("sd", async (ctx) => {
    await handleSpeakCommand({
      command: "sd",
      ctx,
      kind: "design",
      log,
      queue,
      tts,
      usage: "用法：/sd (音色提示) 文本",
    });
  });

  bot.callbackQuery(/^ss:([^:]+):(\d+)$/, async (ctx) => {
    const match = ctx.callbackQuery.data.match(/^ss:([^:]+):(\d+)$/);

    if (!match) {
      await ctx.answerCallbackQuery();
      return;
    }

    const sessionId = match[1]!;
    const voiceIndex = Number(match[2]);
    const payload = voiceSelectStore.read(sessionId);

    if (
      !payload ||
      !Number.isInteger(voiceIndex) ||
      voiceIndex < 0
    ) {
      await ctx.answerCallbackQuery("已过期");
      return;
    }

    const voice = presetVoices[voiceIndex];

    if (!voice) {
      await ctx.answerCallbackQuery("已过期");
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup();

    const taskPromise = (async () => {
      const result = await runBotTask(
        ctx,
        log,
        {
          errorMessage: "语音合成失败",
          queue,
          react: {
            error: "💊",
            pending: "👀",
            success: "👌",
          },
          ...(payload.replyToMessageId !== undefined
            ? { replyToMessageId: payload.replyToMessageId }
            : {}),
        },
        async () =>
          tts.preset({
            ...(payload.instruction ? { instruction: payload.instruction } : {}),
            ...(payload.style ? { style: payload.style } : {}),
            text: payload.text,
            voice: voice.value,
          }),
      );

      if (!result.ok) {
        return;
      }

      await replySpeechAudio(ctx, result.value, {
        caption: `预置：${voice.label}`,
        ...(payload.replyToMessageId !== undefined
          ? { replyToMessageId: payload.replyToMessageId }
          : {}),
        title: "语音",
      });
    })();

    observeBackgroundTask(ctx, log, taskPromise, "后台语音任务执行失败");
  });
}

async function handleSelectSpeakCommand({
  ctx,
  log,
  usage,
  voiceSelectStore,
}: {
  ctx: Context;
  log: Log;
  usage: string;
  voiceSelectStore: CommandDeps["voiceSelectStore"];
}) {
  const message = ctx.message;
  const commandText = readCommandText(ctx);

  if (!message || !commandText) {
    return;
  }

  const params = parseSpeakCommand({
    command: "ss",
    text: commandText,
  });

  if (!params) {
    await replyText(ctx, usage);
    return;
  }

  const text = resolveSpeakText({
    message,
    params,
  });

  if (!text) {
    await replyText(ctx, usage);
    return;
  }

  const replyToMessageId = message.reply_to_message?.message_id ?? message.message_id;
  const sessionId = voiceSelectStore.save({
    ...(params.instruction ? { instruction: params.instruction } : {}),
    ...(params.style ? { style: params.style } : {}),
    replyToMessageId,
    text,
  });

  await replyText(ctx, "选择音色", replyToMessageId, {
    reply_markup: buildVoiceSelectKeyboard(sessionId),
  });
}

async function handleSpeakCommand({
  command,
  ctx,
  kind,
  log,
  queue,
  tts,
  usage,
}: {
  command: string;
  ctx: Context;
  kind: SpeakKind;
  log: Log;
  queue: ChatQueue;
  tts: TtsService;
  usage: string;
}) {
  const message = ctx.message;
  const commandText = readCommandText(ctx);

  if (!message || !commandText) {
    return;
  }

  const params = parseSpeakCommand({
    command,
    text: commandText,
  });

  if (!params) {
    await replyText(ctx, usage);
    return;
  }

  if (kind !== "preset" && !params.voice?.trim()) {
    await replyText(ctx, usage);
    return;
  }

  const text = resolveSpeakText({
    message,
    params,
  });

  if (!text) {
    await replyText(ctx, usage);
    return;
  }

  const taskPromise = runBotTask(
    ctx,
    log,
    {
      errorMessage: "语音合成失败",
      queue,
      react: {
        error: "💊",
        pending: "👀",
        success: "👌",
      },
    },
    async () => {
      const result = await synthesize({
        kind,
        params,
        text,
        tts,
      });

      await replySpeechAudio(ctx, result, {
        caption: buildCaption(kind, params.voice),
        title: "语音",
      });
    },
  );

  observeBackgroundTask(ctx, log, taskPromise, "后台语音任务执行失败");
}

function synthesize({
  kind,
  params,
  text,
  tts,
}: {
  kind: SpeakKind;
  params: SpeakParams;
  text: string;
  tts: TtsService;
}) {
  if (kind === "clone") {
    return tts.clone({
      ...(params.instruction ? { instruction: params.instruction } : {}),
      ...(params.style ? { style: params.style } : {}),
      text,
      ...(params.voice ? { voice: params.voice } : {}),
    });
  }

  if (kind === "design") {
    return tts.design({
      prompt: params.voice ?? "",
      text,
    });
  }

  return tts.preset({
    ...(params.instruction ? { instruction: params.instruction } : {}),
    ...(params.style ? { style: params.style } : {}),
    text,
    ...(params.voice ? { voice: params.voice } : {}),
  });
}

function buildCaption(kind: SpeakKind, voice?: string) {
  if (kind === "preset") {
    return `预置：${voice?.trim() || defaultPresetVoiceId}`;
  }

  if (kind === "design") {
    return `设计：${voice ?? ""}`.trim();
  }

  return `声音源：${voice ?? ""}`.trim();
}

function observeBackgroundTask(
  ctx: Context,
  log: Log,
  task: Promise<unknown>,
  message: string,
) {
  task.catch((error) => {
    log.error(
      {
        chatId: ctx.chat?.id,
        error,
        fromId: ctx.from?.id,
        messageId: ctx.msgId,
      },
      message,
    );
  });
}
