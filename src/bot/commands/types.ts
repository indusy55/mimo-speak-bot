import type { Bot } from "grammy";
import type { Env } from "../../core/env.js";
import type { Log } from "../../core/log.js";
import type { TelegramAudioSource } from "../../telegram/audio-source.js";
import type { TtsService } from "../../tts/service.js";
import type { VoiceSourceService } from "../../voice/service.js";
import type { UploadSessions } from "../upload-session.js";

export type CommandDeps = {
  bot: Bot;
  env: Pick<Env, "ADMIN_IDS" | "FFMPEG_PATH">;
  log: Log;
  telegramAudioSource: TelegramAudioSource;
  tts: TtsService;
  uploadSessions: UploadSessions;
  voiceSources: VoiceSourceService;
};

export type InlineDeps = {
  bot: Bot;
  log: Log;
  voiceSources: VoiceSourceService;
};
