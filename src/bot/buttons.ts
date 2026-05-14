import { InlineKeyboard } from "grammy";
import { presetVoices } from "../tts/preset-voices.js";

export function buildCancelKeyboard(sessionId: string) {
  return new InlineKeyboard().text("取消", `cancel:${sessionId}`);
}

export function buildVoiceSelectKeyboard(sessionId: string) {
  const keyboard = new InlineKeyboard();

  for (const [index, voice] of presetVoices.entries()) {
    keyboard.text(voice.label, `ss:${sessionId}:${index}`).row();
  }

  return keyboard;
}
