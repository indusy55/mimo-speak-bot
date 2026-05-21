import type { Context } from "grammy";
import { defaultPresetVoiceId } from "../../tts/preset-voices.js";
import type { TtsService } from "../../tts/service.js";
import type { Log } from "../../core/log.js";
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
  tts,
}: Pick<
  CommandDeps,
  "bot" | "log" | "tts"
>) {
  bot.command("sp", async (ctx) => {
    await handleSpeakCommand({
      command: "sp",
      ctx,
      kind: "preset",
      log,
      tts,
      usage: "用法：/sp 音色 [-s 风格] [-i 提示词] 文本",
    });
  });

  bot.command("sc", async (ctx) => {
    await handleSpeakCommand({
      command: "sc",
      ctx,
      kind: "clone",
      log,
      tts,
      usage: "用法：/sc 音色 [-s 风格] [-i 提示词] 文本",
    });
  });

  bot.command("sd", async (ctx) => {
    await handleSpeakCommand({
      command: "sd",
      ctx,
      kind: "design",
      log,
      tts,
      usage: "用法：/sd 音色设计描述 [-s 风格] [-i 提示词] 文本",
    });
  });
}

async function handleSpeakCommand({
  command,
  ctx,
  kind,
  log,
  tts,
  usage,
}: {
  command: string;
  ctx: Context;
  kind: SpeakKind;
  log: Log;
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

  if (!params.voice?.trim()) {
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
      ...(params.instruction ? { instruction: params.instruction } : {}),
      prompt: params.voice ?? "",
      ...(params.style ? { style: params.style } : {}),
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
