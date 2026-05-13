import type { InputMediaAudio } from "grammy/types";
import { InputFile } from "grammy";
import { presetVoices } from "../../tts/preset-voices.js";
import type { VoiceSourceService } from "../../voice/service.js";
import { runBotTask } from "../task.js";
import type { InlineDeps } from "./types.js";

const inlineResultLimit = 50;

export const registerInlineQuery = ({
  bot,
  log,
  queue,
  tts,
  voiceSources,
}: InlineDeps) => {
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
      const results = await buildInlineResults({
        text,
        voiceSources,
      });

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

    if (!chosen) {
      return;
    }

    await runBotTask(
      ctx,
      log,
      {
        errorMessage: "内联语音合成失败",
        queue,
        react: {
          error: "👀",
          success: "👍",
        },
      },
      async () => {
        const result =
          chosen.kind === "clone"
            ? await tts.clone({
                text: chosen.text,
                voice: chosen.voice,
              })
            : await tts.preset({
                text: chosen.text,
                voice: chosen.voice,
              });

        await ctx.api.editMessageMediaInline(
          ctx.chosenInlineResult.inline_message_id!,
          buildInlineAudioMedia(result.audio.buffer, result.audio.format),
        );
      },
    );
  });
};

const buildInlineResults = async ({
  text,
  voiceSources,
}: {
  text: string;
  voiceSources: VoiceSourceService;
}) => {
  const presetResults = presetVoices.map((voice) =>
    buildInlineResult({
      kind: "preset",
      text,
      title: `预置 · ${voice.label}`,
      voice: voice.value,
    }),
  );
  const sourceResults = (await voiceSources.list()).map((source) =>
    buildInlineResult({
      kind: "clone",
      text,
      title: `声音源 · ${source.name}`,
      voice: source.name,
    }),
  );

  return [...presetResults, ...sourceResults].slice(0, inlineResultLimit);
};

const buildInlineResult = ({
  kind,
  text,
  title,
  voice,
}: {
  kind: "clone" | "preset";
  text: string;
  title: string;
  voice: string;
}) => ({
  description: text,
  id: buildInlineResultId({
    kind,
    text,
    voice,
  }),
  input_message_content: {
    message_text: text,
  },
  title,
  type: "article" as const,
});

const buildInlineResultId = ({
  kind,
  text,
  voice,
}: {
  kind: "clone" | "preset";
  text: string;
  voice: string;
}) =>
  Buffer.from(JSON.stringify({ kind, text, voice }), "utf8")
    .toString("base64url")
    .slice(0, 64);

const parseInlineResultId = (resultId: string) => {
  try {
    const raw = JSON.parse(Buffer.from(resultId, "base64url").toString("utf8"));

    if (
      !raw ||
      typeof raw !== "object" ||
      (raw.kind !== "clone" && raw.kind !== "preset") ||
      typeof raw.text !== "string" ||
      typeof raw.voice !== "string"
    ) {
      return undefined;
    }

    return {
      kind: raw.kind as "clone" | "preset",
      text: raw.text,
      voice: raw.voice,
    };
  } catch {
    return undefined;
  }
};

const buildInlineAudioMedia = (
  buffer: Buffer,
  format: "mp3" | "ogg" | "wav",
): InputMediaAudio => ({
  media: new InputFile(buffer, `speech.${format}`),
  title: "speech",
  type: "audio",
});
