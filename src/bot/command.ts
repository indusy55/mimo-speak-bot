import { commands, registerBasicCommands } from "./commands/basic.js";
import { registerInlineQuery } from "./commands/inline.js";
import { registerListCommands } from "./commands/list.js";
import { registerSpeakCommands, registerSunCommand } from "./commands/speak.js";
import type { CommandDeps, InlineDeps } from "./commands/types.js";
import { registerVoiceSourceCommands } from "./commands/voice-source.js";

export type { TTSParamsParser } from "./commands/types.js";
export { registerInlineQuery };

export function registerCommands(deps: CommandDeps) {
  deps.bot.api.setMyCommands(commands).catch((error) => {
    deps.log.warn(
      {
        error,
      },
      "failed to sync bot commands",
    );
  });

  registerBasicCommands(deps);
  registerListCommands(deps);
  registerSpeakCommands(deps);
  registerVoiceSourceCommands(deps);

  if (deps.ttsParamsParser) {
    registerSunCommand({
      bot: deps.bot,
      log: deps.log,
      speech: deps.speech,
      ttsParamsParser: deps.ttsParamsParser,
    });
  }
}

export type { CommandDeps, InlineDeps };
