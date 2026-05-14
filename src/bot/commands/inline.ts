import type { InputMediaAudio } from "grammy/types";
import { InputFile } from "grammy";
import { presetVoices } from "../../tts/preset-voices.js";
import type { VoiceSourceService } from "../../voice/service.js";
import { runBotTask } from "../task.js";
import type { InlineDeps } from "./types.js";

const inlineResultLimit = 50;

export function registerInlineQuery({
  bot,
  log,
  queue,
  tts,
  voiceSources,
}: InlineDeps) {
  bot.on("inline_query", async (ctx) => {
    const text = ctx.inlineQuery.query.trim();

    if (!text) {
      await ctx.answerInlineQuery([], {
        cache_time: 0,
        is_personal: true,
      });
      return;
    }

    try {
      const results = await buildInlineResults(voiceSources);

      await ctx.answerInlineQuery(results, {
        cache_time: 0,
        is_personal: true,
      });
    } catch (error) {
      log.error(
        {
          error,
          fromId: ctx.from?.id,
          inlineQueryId: ctx.inlineQuery.id,
        },
        "failed to handle inline query",
      );

      await ctx.answerInlineQuery([], {
        cache_time: 0,
        is_personal: true,
      });
    }
  });

  bot.on("chosen_inline_result", async (ctx) => {
    if (!ctx.chosenInlineResult.inline_message_id) {
      return;
    }

    const chosen = parseInlineResultId(ctx.chosenInlineResult.result_id);
    const text = ctx.chosenInlineResult.query.trim();

    if (!chosen || !text) {
      return;
    }

    await runBotTask(
      ctx,
      log,
      {
        errorMessage: "内联语音合成失败",
        queue,
        react: {
          error: "💊",
          pending: "👀",
          success: "👌",
        },
      },
      async () => {
        const result =
          chosen.kind === "clone"
            ? await tts.clone({
                text,
                voice: chosen.voice,
              })
            : await tts.preset({
                text,
                voice: chosen.voice,
              });

        await ctx.api.editMessageMediaInline(
          ctx.chosenInlineResult.inline_message_id!,
          buildInlineAudioMedia(result.audio.buffer, result.audio.format),
        );
      },
    );
  });
}

async function buildInlineResults(voiceSources: VoiceSourceService) {
  const presetResults = presetVoices.map((voice) =>
    buildInlineResult({
      kind: "preset",
      title: voice.label,
      voice: voice.value,
    }),
  );
  const sourceResults = (await voiceSources.list()).map((source) =>
    buildInlineResult({
      kind: "clone",
      title: source.name,
      voice: source.name,
    }),
  );

  return [...presetResults, ...sourceResults].slice(0, inlineResultLimit);
}

function buildInlineResult({
  kind,
  title,
  voice,
}: {
  kind: "clone" | "preset";
  title: string;
  voice: string;
}) {
  return {
    id: buildInlineResultId({
      kind,
      voice,
    }),
    input_message_content: {
      message_text: " ",
    },
    title,
    type: "article" as const,
  };
}

function buildInlineResultId({
  kind,
  voice,
}: {
  kind: "clone" | "preset";
  voice: string;
}) {
  return Buffer.from(JSON.stringify({ kind, voice }), "utf8").toString(
    "base64url",
  );
}

function parseInlineResultId(resultId: string) {
  try {
    const raw = JSON.parse(Buffer.from(resultId, "base64url").toString("utf8"));

    if (
      !raw ||
      typeof raw !== "object" ||
      (raw.kind !== "clone" && raw.kind !== "preset") ||
      typeof raw.voice !== "string"
    ) {
      return undefined;
    }

    return {
      kind: raw.kind as "clone" | "preset",
      voice: raw.voice,
    };
  } catch {
    return undefined;
  }
}

function buildInlineAudioMedia(
  buffer: Buffer,
  format: "mp3" | "ogg" | "wav",
): InputMediaAudio {
  return {
    media: new InputFile(buffer, `speech.${format}`),
    title: "speech",
    type: "audio",
  };
}
