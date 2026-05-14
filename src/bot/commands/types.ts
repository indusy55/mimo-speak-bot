import type { Bot } from "grammy";
import type { Env } from "../../core/env.js";
import type { Log } from "../../core/log.js";
import type { TelegramAudioSource } from "../../telegram/audio-source.js";
import type { TtsService } from "../../tts/service.js";
import type { VoiceSourceService } from "../../voice/service.js";
import type { ChatQueue } from "../queue.js";
import type { UploadSessions } from "../upload-session.js";
import type { VoiceSelectStore } from "../voice-select-store.js";

export type CommandDeps = {
  bot: Bot;
  env: Pick<Env, "ADMIN_IDS">;
  log: Log;
  queue: ChatQueue;
  telegramAudioSource: TelegramAudioSource;
  tts: TtsService;
  uploadSessions: UploadSessions;
  voiceSources: VoiceSourceService;
  voiceSelectStore: VoiceSelectStore;
};

export type InlineDeps = {
  bot: Bot;
  log: Log;
  voiceSources: VoiceSourceService;
};
