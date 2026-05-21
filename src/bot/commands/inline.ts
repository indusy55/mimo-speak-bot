import { createHash } from "node:crypto";
import type { InlineQueryResultArticle } from "grammy/types";
import { defaultPresetVoiceId } from "../../tts/preset-voices.js";
import { presetVoices } from "../../tts/preset-voices.js";
import type { VoiceSourceService } from "../../voice/service.js";
import type { InlineDeps } from "./types.js";

const inlineResultLimit = 50;
const defaultPresetTitle = "【预置】默认音色";

export function registerInlineQuery({
  bot,
  log,
  voiceSources,
}: Pick<InlineDeps, "bot" | "log" | "voiceSources">) {
  bot.on("inline_query", async (ctx) => {
    const queryText = ctx.inlineQuery.query.trim();

    try {
      const results = await buildInlineResults({
        queryText,
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
}

async function buildInlineResults({
  queryText,
  voiceSources,
}: {
  queryText: string;
  voiceSources: VoiceSourceService;
}): Promise<InlineQueryResultArticle[]> {
  const results: InlineQueryResultArticle[] = [
    buildInlineResult({
      kind: "preset",
      queryText,
      title: defaultPresetTitle,
      voiceName: defaultPresetVoiceId,
    }),
  ];

  for (const [index, voice] of presetVoices.entries()) {
    if (results.length >= inlineResultLimit) {
      break;
    }

    results.push(
      buildInlineResult({
        kind: "preset",
        queryText,
        title: `【预置】${voice.label}`,
        voiceName: voice.value,
        voiceOrder: index + 1,
      }),
    );
  }

  const sources = await voiceSources.list();

  for (const [index, source] of sources.entries()) {
    if (results.length >= inlineResultLimit) {
      break;
    }

    results.push(
      buildInlineResult({
        kind: "clone",
        queryText,
        title: `【声音源】${source.name}`,
        voiceName: source.name,
        voiceOrder: index,
      }),
    );
  }

  return results;
}

function buildInlineResult({
  kind,
  queryText,
  title,
  voiceName,
  voiceOrder,
}: {
  kind: "clone" | "preset";
  queryText: string;
  title: string;
  voiceName?: string;
  voiceOrder?: number;
}): InlineQueryResultArticle {
  return {
    description: buildDescription(kind, voiceName),
    id: buildResultId(kind, queryText, voiceName, voiceOrder),
    input_message_content: {
      message_text: buildCommandText(kind, queryText, voiceName),
    },
    title,
    type: "article",
  };
}

function buildDescription(kind: "clone" | "preset", voiceName?: string) {
  const modeLabel = kind === "clone" ? "声音源" : "预置";
  return `${modeLabel} · ${voiceName ?? "默认音色"}`;
}

function buildResultId(
  kind: "clone" | "preset",
  queryText: string,
  voiceName?: string,
  voiceOrder?: number,
) {
  return createHash("sha1")
    .update(
      JSON.stringify({
        kind,
        queryText,
        voiceName: voiceName ?? "",
        voiceOrder: voiceOrder ?? -1,
      }),
    )
    .digest("hex");
}

function buildCommandText(
  kind: "clone" | "preset",
  queryText: string,
  voiceName?: string,
) {
  const command = kind === "clone" ? "/sc" : "/sp";

  if (!voiceName) {
    return queryText.length > 0 ? `${command} ${queryText}` : command;
  }

  return queryText.length > 0
    ? `${command} ${formatCommandArgument(voiceName)} ${queryText}`
    : `${command} ${formatCommandArgument(voiceName)}`;
}

function formatCommandArgument(value: string) {
  if (!value.startsWith("-") && /^\S+$/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}
