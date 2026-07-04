import type { Bot } from "grammy";
import type { SpeechService } from "../../ai/speech.js";
import type { Env } from "../../core/env.js";
import type { Log } from "../../core/log.js";
import type { TelegramAudioSource } from "../../telegram/audio-source.js";
import type { VoiceSourceService } from "../../voice/service.js";
import type { UploadSessions } from "../upload-session.js";

export type TTSParamsParser = {
  parse: (input: string) => Promise<{
    text: string;
    voice?: string;
    instructions?: string;
    mode?: "clone" | "design" | "preset";
  }>;
};

export type CommandDeps = {
  bot: Bot;
  env: Pick<Env, "ADMIN_IDS" | "FFMPEG_PATH">;
  log: Log;
  speech: SpeechService;
  telegramAudioSource: TelegramAudioSource;
  ttsParamsParser?: TTSParamsParser;
  uploadSessions: UploadSessions;
  voiceSources: VoiceSourceService;
};

export type InlineDeps = {
  bot: Bot;
  log: Log;
  voiceSources: VoiceSourceService;
};
