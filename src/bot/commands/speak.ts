import { InputFile, type Context } from "grammy";
import type { SpeechService } from "../../ai/speech.js";
import { defaultPresetVoiceId } from "../../ai/preset-voices.js";
import type { Log } from "../../core/log.js";
import { mergeAudioClips } from "../../voice/merger.js";
import {
  parseSpeakCommand,
  readCommandText,
  readReplyTextCandidates,
  resolveSpeakText,
  type SpeakParams,
} from "../parse.js";
import { replyOptions, replySpeechAudio, replyText } from "../reply.js";
import { runBotTask } from "../task.js";
import type { CommandDeps, TTSParamsParser } from "./types.js";

type SpeakKind = "clone" | "design" | "preset";

export function registerSpeakCommands({
  bot,
  log,
  speech,
  env,
}: Pick<CommandDeps, "bot" | "log" | "speech" | "env">) {
  bot.command("sp", async (ctx) => {
    await handleSpeakCommand({
      command: "sp",
      ctx,
      kind: "preset",
      log,
      speech,
      usage: "用法：/sp 音色 [-s 风格] [-i 提示词] 文本",
    });
  });

  bot.command("sc", async (ctx) => {
    await handleSpeakCommand({
      command: "sc",
      ctx,
      kind: "clone",
      log,
      speech,
      usage: "用法：/sc 音色 [-s 风格] [-i 提示词] 文本",
    });
  });

  bot.command("sd", async (ctx) => {
    await handleSpeakCommand({
      command: "sd",
      ctx,
      kind: "design",
      log,
      speech,
      usage: "用法：/sd 音色设计描述 [-s 风格] [-i 提示词] 文本",
    });
  });

  bot.command("spp", async (ctx) => {
    await handleMultiSpeakCommand({
      command: "spp",
      ctx,
      env,
      kind: "preset",
      log,
      speech,
    });
  });

  bot.command("scc", async (ctx) => {
    await handleMultiSpeakCommand({
      command: "scc",
      ctx,
      env,
      kind: "clone",
      log,
      speech,
    });
  });

  bot.command("sdd", async (ctx) => {
    await handleMultiSpeakCommand({
      command: "sdd",
      ctx,
      env,
      kind: "design",
      log,
      speech,
    });
  });
}

export function registerSunCommand({
  bot,
  log,
  speech,
  ttsParamsParser,
}: Pick<CommandDeps, "bot" | "log" | "speech"> & {
  ttsParamsParser: TTSParamsParser;
}) {
  bot.command("sg", async (ctx) => {
    const message = ctx.message;
    const commandText = readCommandText(ctx);

    if (!message || !commandText) {
      return;
    }

    const userText = commandText
      .replace(/^\/sg(?:@\w+)?(?:\s+|$)/, "")
      .trim();

    let llmInput: string | undefined;
    let caption = "";

    // Get reply/quote text if available
    let quoted: string | undefined;
    for (const text of readReplyTextCandidates(message)) {
      const trimmed = text?.trim();
      if (trimmed) {
        quoted = trimmed;
        break;
      }
    }

    if (userText && quoted) {
      llmInput = `${quoted}\n\n额外要求：${userText}`;
      caption = quoted;
    } else if (userText) {
      llmInput = userText;
    } else if (quoted) {
      llmInput = quoted;
      caption = quoted;
    }

    if (!llmInput) {
      await replyText(ctx, "用法：/sg 自然语言描述\n或回复一条消息 /sg");
      return;
    }

    await runBotTask(
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
        const params = await ttsParamsParser.parse(llmInput);
        const mode = params.mode ?? "preset";

        const result = await speech.synthesize({
          mode,
          text: params.text,
          voice: params.voice ?? "",
          ...(params.instructions !== undefined
            ? { instruction: params.instructions }
            : {}),
        });

        const captionText = caption || params.voice
          ? `${mode === "clone" ? "声音源" : mode === "design" ? "设计" : "预置"}：${params.voice || "默认"}`
          : undefined;

        await replySpeechAudio(ctx, result, {
          ...(captionText ? { caption: captionText } : {}),
          title: "语音",
        });
      },
    );
  });
}

async function handleSpeakCommand({
  command,
  ctx,
  kind,
  log,
  speech,
  usage,
}: {
  command: string;
  ctx: Context;
  kind: SpeakKind;
  log: Log;
  speech: SpeechService;
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
    if (kind !== "preset") {
      await replyText(ctx, usage);
      return;
    }

    params.voice = defaultPresetVoiceId;
  }

  const text = resolveSpeakText({
    message,
    params,
  });

  if (!text) {
    await replyText(ctx, usage);
    return;
  }

  await runBotTask(
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
        instruction: params.instruction,
        kind,
        params,
        speech,
        style: params.style,
        text,
      });

      await replySpeechAudio(ctx, result, {
        caption: buildCaption(kind, params.voice),
        title: "语音",
      });
    },
  );
}

async function handleMultiSpeakCommand({
  command,
  ctx,
  env,
  kind,
  log,
  speech,
}: {
  command: string;
  ctx: Context;
  env: Pick<CommandDeps, "env">["env"];
  kind: SpeakKind;
  log: Log;
  speech: SpeechService;
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

  await runBotTask(
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
      const results = await Promise.all(
        lines.map((line) =>
          speech.synthesize({
            mode: kind,
            text: line.text,
            voice: line.voice,
            ...(line.instruction !== undefined
              ? { instruction: line.instruction }
              : {}),
            ...(line.style !== undefined ? { style: line.style } : {}),
          }),
        ),
      );

      const merged = await mergeAudioClips(
        results.map((result) => result.buffer),
        { ...(env.FFMPEG_PATH ? { ffmpegPath: env.FFMPEG_PATH } : {}) },
      );

      const voiceNames = lines.map((line) => line.voice).join(", ");

      await ctx.replyWithAudio(new InputFile(merged, "speech.wav"), {
        caption: buildCaption(kind, voiceNames),
        title: "对话",
        ...replyOptions(ctx),
      });
    },
  );
}

async function synthesize({
  instruction,
  kind,
  params,
  speech,
  style,
  text,
  voice,
}: {
  instruction: string | undefined;
  kind: SpeakKind;
  params: SpeakParams;
  speech: SpeechService;
  style: string | undefined;
  text: string;
  voice?: string;
}) {
  return speech.synthesize({
    mode: kind,
    text,
    voice: voice ?? params.voice ?? "",
    ...(instruction !== undefined ? { instruction } : {}),
    ...(style !== undefined ? { style } : {}),
  });
}

function buildCaption(kind: SpeakKind, voice?: string) {
  if (kind === "preset") {
    return `预置：${voice?.trim() || defaultPresetVoiceId}`;
  }

  if (kind === "design") {
    return `设计：${voice?.trim() || "未知设计"}`;
  }

  return `声音源：${voice?.trim() || "未知音源"}`;
}

type MultiLineItem = {
  voice: string;
  style?: string;
  instruction?: string;
  text: string;
};

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

  const blocks = cleaned
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);


  const result: MultiLineItem[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return undefined;
    }

    const firstLine = lines[0];
    const continuationText = lines.slice(1).join("\n");

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
      ...(params.instruction !== undefined
        ? { instruction: params.instruction }
        : {}),
      text,
    });
  }

  return result;
}
