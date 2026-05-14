import { InputFile, type Context } from "grammy";
import type { TtsResult } from "../tts/api.js";

const maxTelegramCaptionLength = 1024;

export function replyOptions(ctx: Context, replyToMessageId?: number) {
  return ctx.chat?.type === "private"
    ? {}
    : replyToMessageId !== undefined
      ? {
          reply_parameters: {
            message_id: replyToMessageId,
          },
        }
      : ctx.message
        ? {
            reply_parameters: {
              message_id: ctx.message.message_id,
            },
          }
        : {};
}

export function replyText(
  ctx: Context,
  text: string,
  replyToMessageId?: number,
  extra?: Parameters<Context["reply"]>[1],
) {
  return ctx.reply(text, {
    ...replyOptions(ctx, replyToMessageId),
    ...(extra ?? {}),
  });
}

export function replySpeechAudio(
  ctx: Context,
  result: TtsResult,
  {
    caption,
    replyMarkup,
    replyToMessageId,
    title,
  }: {
    caption?: string;
    replyMarkup?: NonNullable<
      Parameters<Context["replyWithAudio"]>[1]
    >["reply_markup"];
    replyToMessageId?: number;
    title: string;
  },
) {
  return ctx.replyWithAudio(
    new InputFile(result.audio.buffer, `speech.${result.audio.format}`),
    {
      ...(caption ? { caption: trimCaption(caption) } : {}),
      ...replyOptions(ctx, replyToMessageId),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      title,
    },
  );
}

export function replyAudioButton(
  ctx: Context,
  result: TtsResult,
  {
    caption,
    replyMarkup,
    replyToMessageId,
    title,
  }: {
    caption?: string;
    replyMarkup?: NonNullable<
      Parameters<Context["replyWithAudio"]>[1]
    >["reply_markup"];
    replyToMessageId?: number;
    title: string;
  },
) {
  return ctx.replyWithAudio(
    new InputFile(result.audio.buffer, `speech.${result.audio.format}`),
    {
      ...(caption ? { caption: trimCaption(caption) } : {}),
      ...replyOptions(ctx, replyToMessageId),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      title,
    },
  );
}

export function trimCaption(caption: string) {
  return caption.length <= maxTelegramCaptionLength
    ? caption
    : caption.slice(0, maxTelegramCaptionLength);
}
