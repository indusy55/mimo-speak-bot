import { InputFile, type Context } from "grammy";
import type { AudioFormat } from "../ai/speech.js";


const maxTelegramCaptionLength = 1024;

export type SpeechAudio = {
  buffer: Buffer;
  format: AudioFormat;
};

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
  result: SpeechAudio,
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
    new InputFile(result.buffer, `speech.${result.format}`),
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
