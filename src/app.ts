import { Bot, BotError } from "grammy";
import { registerCommands, registerInlineQuery } from "./bot/command.js";
import { createChatQueue } from "./bot/queue.js";
import { createUploadSessions } from "./bot/upload-session.js";
import { createVoiceSelectStore } from "./bot/voice-select-store.js";
import { loadEnv } from "./core/env.js";
import { log } from "./core/log.js";
import { createTelegramAudioSource } from "./telegram/audio-source.js";
import { createTelegramFiles } from "./telegram/files.js";
import { createTtsApi } from "./tts/api.js";
import { createTtsService } from "./tts/service.js";
import { createVoiceSourceService } from "./voice/service.js";
import { createVoiceSourceStore } from "./voice/store.js";
import { createVoiceSourceTranscoder } from "./voice/transcoder.js";

export async function bootstrap() {
  const env = loadEnv();

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  const queue = createChatQueue();
  const uploadSessions = createUploadSessions();
  const voiceSelectStore = createVoiceSelectStore();
  const voiceSourceStore = createVoiceSourceStore({ env });
  const voiceSources = createVoiceSourceService({
    store: voiceSourceStore,
    transcoder: createVoiceSourceTranscoder(
      env.FFMPEG_PATH ? { ffmpegPath: env.FFMPEG_PATH } : {},
    ),
  });
  const tts = createTtsService({
    api: createTtsApi({ env }),
    voiceSources: voiceSourceStore,
  });
  const telegramAudioSource = createTelegramAudioSource({
    env,
    files: createTelegramFiles({
      api: bot.api,
      env,
    }),
  });

  registerCommands({
    bot,
    env,
    log,
    queue,
    telegramAudioSource,
    tts,
    uploadSessions,
    voiceSources,
    voiceSelectStore,
  });

  registerInlineQuery({
    bot,
    log,
    voiceSources,
  });

  bot.catch((error: BotError) => {
    log.error(
      {
        error,
      },
      "bot middleware error",
    );
  });

  await bot.start({
    onStart: async (me) => {
      log.info(
        {
          username: me.username,
        },
        "bot started",
      );
    },
  });
}
