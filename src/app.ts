import { Bot, BotError } from "grammy";
import { createSpeechService } from "./ai/speech.js";
import { createTtsParamsParser } from "./ai/parse-tts-params.js";
import { registerCommands, registerInlineQuery } from "./bot/command.js";
import { createUploadSessions } from "./bot/upload-session.js";
import { createDb } from "./db/client.js";
import { loadEnv } from "./core/env.js";
import { log } from "./core/log.js";
import { createTelegramAudioSource } from "./telegram/audio-source.js";
import { createTelegramFiles } from "./telegram/files.js";
import { createVoiceFileStore } from "./voice/file-store.js";
import { createVoiceSourceRepository } from "./voice/repository.js";
import { createVoiceSourceService } from "./voice/service.js";
import { createVoiceSourceTranscoder } from "./voice/transcoder.js";
import { migrateLegacyVoiceSources } from "./voice/migrate-legacy.js";

export async function bootstrap() {
  const env = loadEnv();

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  const db = createDb(env);
  const uploadSessions = createUploadSessions();

  const voiceRepository = createVoiceSourceRepository({ db });
  const voiceFileStore = createVoiceFileStore({
    dir: env.TTS_VOICE_SOURCES_DIR,
  });
  const voiceSources = createVoiceSourceService({
    fileStore: voiceFileStore,
    repository: voiceRepository,
    transcoder: createVoiceSourceTranscoder(
      env.FFMPEG_PATH ? { ffmpegPath: env.FFMPEG_PATH } : {},
    ),
  });

  const migrated = await migrateLegacyVoiceSources({
    dir: env.TTS_VOICE_SOURCES_DIR,
    fileStore: voiceFileStore,
    repository: voiceRepository,
  });

  if (migrated > 0) {
    log.info({ migrated }, "migrated legacy voice sources");
  }

  const cloneVoiceNames = (await voiceSources.list()).map((s) => s.name);

  const ttsParamsParser = env.OPENAI_API_KEY
    ? createTtsParamsParser({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_API_BASE_URL,
        cloneVoiceNames,
        model: env.OPENAI_API_MODEL,
      })
    : undefined;

  const speech = createSpeechService({
    apiKey: env.TTS_API_KEY,
    voiceSources,
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
    speech,
    telegramAudioSource,
    ...(ttsParamsParser ? { ttsParamsParser } : {}),
    uploadSessions,
    voiceSources,
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
