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
  let rest = body.trim();

  if (!rest.startsWith("-")) {
    const voice = readNextArgument(rest);

    if (!voice || voice.value.length === 0) {
      return undefined;
    }

    params.voice = voice.value;
    rest = voice.rest;
  }

  while (rest.startsWith("-")) {
    const flag = readFlag(rest);

    if (!flag) {
      return undefined;
    }

    if (flag.name !== "s" && flag.name !== "i") {
      return undefined;
    }

    const value = readNextArgument(flag.rest);

    if (!value || (!value.quoted && value.value.startsWith("-"))) {
      return undefined;
    }

    if (value.value.length === 0) {
      return undefined;
    }

    if (flag.name === "s") {
      params.style = value.value;
    } else {
      params.instruction = value.value;
    }

    rest = value.rest;
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

function readFlag(text: string) {
  const match = text.match(/^-(\S+)/);

  if (!match) {
    return undefined;
  }

  return {
    name: match[1]!,
    rest: text.slice(match[0].length).trim(),
  };
}

function readNextArgument(text: string) {
  const source = text.trim();

  if (source.length === 0) {
    return undefined;
  }

  const quote = source[0];

  if (quote === "\"" || quote === "'") {
    let value = "";
    let escaped = false;

    for (let index = 1; index < source.length; index += 1) {
      const char = source[index]!;

      if (escaped) {
        value += char;
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === quote) {
        return {
          quoted: true,
          rest: source.slice(index + 1).trim(),
          value: value.trim(),
        };
      }

      value += char;
    }

    return undefined;
  }

  const match = source.match(/^\S+/);

  if (!match) {
    return undefined;
  }

  return {
    quoted: false,
    rest: source.slice(match[0].length).trim(),
    value: match[0].trim(),
  };
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
    const match = body.match(/^(\S+)/);

    if (!match || match[1] === undefined) {
      return undefined;
    }

    const name = match[1];
    const rest = body.slice(name.length).trim();

    if (rest.length > 0) {
      return undefined;
    }

    return name;
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
