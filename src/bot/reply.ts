import { InputFile, type Context } from "grammy";
import type { TtsResult } from "../tts/api.js";

const maxTelegramCaptionLength = 1024;

export const replyOptions = (ctx: Context, replyToMessageId?: number) =>
  ctx.chat?.type === "private"
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

export const replyText = (
  ctx: Context,
  text: string,
  replyToMessageId?: number,
  extra?: Parameters<Context["reply"]>[1],
) =>
  ctx.reply(text, {
    ...replyOptions(ctx, replyToMessageId),
    ...(extra ?? {}),
  });

export const replySpeechAudio = (
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
) =>
  ctx.replyWithAudio(
    new InputFile(result.audio.buffer, `speech.${result.audio.format}`),
    {
      ...(caption ? { caption: trimCaption(caption) } : {}),
      ...replyOptions(ctx, replyToMessageId),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      title,
    },
  );

export const replyAudioButton = (
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
) =>
  ctx.replyWithAudio(
    new InputFile(result.audio.buffer, `speech.${result.audio.format}`),
    {
      ...(caption ? { caption: trimCaption(caption) } : {}),
      ...replyOptions(ctx, replyToMessageId),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      title,
    },
  );

export const trimCaption = (caption: string) =>
  caption.length <= maxTelegramCaptionLength
    ? caption
    : caption.slice(0, maxTelegramCaptionLength);
