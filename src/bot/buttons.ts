import { InlineKeyboard } from "grammy";
import { presetVoices } from "../tts/preset-voices.js";

export const buildCancelKeyboard = (sessionId: string) =>
  new InlineKeyboard().text("取消", `cancel:${sessionId}`);

export const buildVoiceSelectKeyboard = (sessionId: string) => {
  const keyboard = new InlineKeyboard();

  for (const [index, voice] of presetVoices.entries()) {
    keyboard.text(voice.label, `ss:${sessionId}:${index}`).row();
  }

  return keyboard;
};
