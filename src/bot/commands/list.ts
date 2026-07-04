import { presetVoices } from "../../ai/preset-voices.js";
import { replyText } from "../reply.js";
import { runBotTask } from "../task.js";
import type { CommandDeps } from "./types.js";

export function registerListCommands({
  bot,
  log,
  voiceSources,
}: Pick<CommandDeps, "bot" | "log" | "voiceSources">) {
  bot.command("vp", async (ctx) => {
    await replyText(
      ctx,
      [
        "预置音色：",
        ...presetVoices.map(
          (voice, index) => `${index + 1}. ${voice.label} (${voice.value})`,
        ),
      ].join("\n"),
    );
  });

  bot.command("vs", async (ctx) => {
    const result = await runBotTask(
      ctx,
      log,
      {
        errorMessage: "failed to list voice sources",
      },
      () => voiceSources.list(),
    );

    if (!result.ok) {
      return;
    }

    await replyText(
      ctx,
      result.value.length > 0
        ? [
            "声音源：",
            ...result.value.map((source, index) => `${index + 1}. ${source.name}`),
          ].join("\n")
        : "没有找到声音源。",
    );
  });
}
