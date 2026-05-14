import type { Context } from "grammy";
import type { Message } from "grammy/types";

export type SpeakParams = {
  instruction?: string;
  style?: string;
  text?: string;
  voice?: string;
};

export function readCommandText(ctx: Context) {
  const message = ctx.message;

  return message && "text" in message ? message.text : undefined;
}

export function parseSpeakCommand({
  command,
  text,
}: {
  command: string | string[];
  text: string;
}): SpeakParams | undefined {
  const trimmed = text.trim();
  const names = Array.isArray(command) ? command : [command];
  const match = trimmed.match(
    new RegExp(`^/(?:${names.join("|")})(?:@\\w+)?(?:\\s+|$)`),
  );

  if (!match) {
    return undefined;
  }

  const body = trimmed.slice(match[0].length).trim();

  if (body.length === 0) {
    return {};
  }

  const params: SpeakParams = {};
  let rest = body;

  while (rest.startsWith("[") || rest.startsWith("{") || rest.startsWith("(")) {
    if (rest.startsWith("[")) {
      const end = rest.indexOf("]");

      if (end <= 1) {
        return undefined;
      }

      const value = rest.slice(1, end).trim();

      if (value.length > 0) {
        params.instruction = value;
      }

      rest = rest.slice(end + 1).trim();
      continue;
    }

    if (rest.startsWith("{")) {
      const end = rest.indexOf("}");

      if (end <= 1) {
        return undefined;
      }

      const value = rest.slice(1, end).trim();

      if (value.length > 0) {
        params.style = value;
      }

      rest = rest.slice(end + 1).trim();
      continue;
    }

    const end = rest.indexOf(")");

    if (end <= 1) {
      return undefined;
    }

    const value = rest.slice(1, end).trim();

    if (value.length > 0) {
      params.voice = value;
    }

    rest = rest.slice(end + 1).trim();
  }

  if (
    params.instruction === undefined &&
    params.style === undefined &&
    params.voice === undefined
  ) {
    return {
      text: body,
    };
  }

  if (rest.length > 0) {
    params.text = rest;
  }

  return params;
}

export function resolveSpeakText({
  message,
  params,
}: {
  message: Message;
  params: SpeakParams;
}) {
  if (params.text?.trim()) {
    return params.text.trim();
  }

  for (const text of readReplyTextCandidates(message)) {
    const trimmed = text?.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}

export function* readReplyTextCandidates(message: Message): Generator<string | undefined> {
  yield readStringField(readObjectField(message, "quote"), "text");

  yield message.reply_to_message?.text;
  yield message.reply_to_message?.caption;

  const externalReply = readObjectField(message, "external_reply");
  yield readStringField(readObjectField(externalReply, "quote"), "text");
  yield readStringField(externalReply, "text");
  yield readStringField(externalReply, "caption");

  const externalMessage = readObjectField(externalReply, "message");
  yield readStringField(externalMessage, "text");
  yield readStringField(externalMessage, "caption");
}

function readObjectField(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    return undefined;
  }

  const field = (value as Record<string, unknown>)[key];
  return field && typeof field === "object" ? field : undefined;
}

function readStringField(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    return undefined;
  }

  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
}

export function parseNameOnlyCommand({
  command,
  text,
}: {
  command: string | string[];
  text: string;
}) {
  const trimmed = text.trim();
  const names = Array.isArray(command) ? command : [command];
  const match = trimmed.match(
    new RegExp(`^/(?:${names.join("|")})(?:@\\w+)?(?:\\s+|$)`),
  );

  if (!match) {
    return undefined;
  }

  const body = trimmed.slice(match[0].length).trim();

  if (body.length === 0) {
    return undefined;
  }

  if (!body.startsWith("(")) {
    return body;
  }

  const end = body.indexOf(")");

  if (end <= 1) {
    return undefined;
  }

  const name = body.slice(1, end).trim();
  const rest = body.slice(end + 1).trim();

  if (rest.length > 0 || name.length === 0) {
    return undefined;
  }

  return name;
}
