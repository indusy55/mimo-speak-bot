import { InputFile, type Context } from "grammy";
import { defaultPresetVoiceId } from "../../tts/preset-voices.js";
import type { TtsService } from "../../tts/service.js";
import type { Log } from "../../core/log.js";
import {
  parseSpeakCommand,
  readCommandText,
  resolveSpeakText,
  type SpeakParams,
} from "../parse.js";
import { replyOptions, replySpeechAudio, replyText } from "../reply.js";
import { runBotTask } from "../task.js";
import { mergeAudioClips } from "../../voice/merger.js";
import type { CommandDeps } from "./types.js";

type SpeakKind = "clone" | "design" | "preset";

export function registerSpeakCommands({
  bot,
  log,
  tts,
  env,
}: Pick<
  CommandDeps,
  "bot" | "log" | "tts" | "env"
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

  bot.command("spp", async (ctx) => {
    await handleMultiSpeakCommand({
      command: "spp",
      ctx,
      kind: "preset",
      log,
      tts,
      env,
    });
  });

  bot.command("scc", async (ctx) => {
    await handleMultiSpeakCommand({
      command: "scc",
      ctx,
      kind: "clone",
      log,
      tts,
      env,
    });
  });

  bot.command("sdd", async (ctx) => {
    await handleMultiSpeakCommand({
      command: "sdd",
      ctx,
      kind: "design",
      log,
      tts,
      env,
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

async function handleMultiSpeakCommand({
  command,
  ctx,
  kind,
  log,
  tts,
  env,
}: {
  command: string;
  ctx: Context;
  kind: SpeakKind;
  log: Log;
  tts: TtsService;
  env: Pick<CommandDeps, "env">["env"];
}) {
  const commandText = readCommandText(ctx);

  if (!commandText) {
    return;
  }

  const lines = parseMultiLineCommand({
    command,
    text: commandText,
  });

  if (!lines) {
    await replyText(
      ctx,
      `用法：/${command}\n音色 [-s 风格] [-i 提示词] 文本\n\n音色 [-s 风格] [-i 提示词] 文本\n\n（不同语音之间用空行分隔）`,
    );
    return;
  }

  const taskPromise = runBotTask(
    ctx,
    log,
    {
      errorMessage: "对话合成失败",
      react: {
        error: "💊",
        pending: "👀",
        success: "👌",
      },
    },
    async () => {
      const results = await runConcurrent(
        lines,
        2,
        (line) =>
          synthesize({
            kind,
            params: {
              voice: line.voice,
              ...(line.style !== undefined ? { style: line.style } : {}),
              ...(line.instruction !== undefined ? { instruction: line.instruction } : {}),
            },
            text: line.text,
            tts,
          }),
      );

      const merged = await mergeAudioClips(
        results.map((r) => r.audio.buffer),
        { ...(env.FFMPEG_PATH ? { ffmpegPath: env.FFMPEG_PATH } : {}) },
      );

      const voiceNames = lines.map((l) => l.voice).join(", ");

      await ctx.replyWithAudio(new InputFile(merged, "speech.wav"), {
        caption: buildCaption(kind, voiceNames),
        title: "对话",
        ...replyOptions(ctx),
      });
    },
  );

  observeBackgroundTask(ctx, log, taskPromise, "后台对话合成失败");
}

/**
 * Run async tasks with limited concurrency.
 */
async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  const queue = items.map((item, index) => ({ item, index }));

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (entry) {
        results[entry.index] = await fn(entry.item);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
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

type MultiLineItem = {
  voice: string;
  style?: string;
  instruction?: string;
  text: string;
};

/**
 * Parse multi-line command input.
 *
 * Blocks are separated by blank lines.  Each block:
 *   voice [-s style] [-i instruction] text…
 *   continuation text…
 *
 * Reuses parseSpeakCommand for the first line of each block.
 */
function parseMultiLineCommand({
  command,
  text,
}: {
  command: string;
  text: string;
}): MultiLineItem[] | undefined {
  const cleaned = text.replace(new RegExp(`^/${command}(@\\w+)?\\s*`), "").trim();

  if (!cleaned) {
    return undefined;
  }

  // Split by blank lines — empty or whitespace-only lines
  const blocks = cleaned
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  if (blocks.length < 2) {
    return undefined;
  }

  const result: MultiLineItem[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return undefined;
    }

    const firstLine = lines[0];
    const continuationText = lines.slice(1).join("\n");

    // Reuse the existing single-line parser by prepending /sp
    const params = parseSpeakCommand({
      command: "sp",
      text: `/sp ${firstLine}`,
    });

    if (!params || !params.voice) {
      return undefined;
    }

    const textParts = [
      ...(params.text ? [params.text] : []),
      ...(continuationText ? [continuationText] : []),
    ];
    const text = textParts.join("\n").trim();

    if (!text) {
      return undefined;
    }

    result.push({
      voice: params.voice,
      ...(params.style !== undefined ? { style: params.style } : {}),
      ...(params.instruction !== undefined ? { instruction: params.instruction } : {}),
      text,
    });
  }

  return result;
}
