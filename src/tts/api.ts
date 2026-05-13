import type { Env } from "../core/env.js";
import {
  createRequestSignal,
  type RequestOptions as BaseRequestOptions,
} from "../core/request.js";
import { defaultPresetVoiceId } from "./preset-voices.js";

type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type RequestOptions = {
  body?: JsonValue;
} & BaseRequestOptions;

export type AudioFormat = "mp3" | "ogg" | "wav";

export type TtsResult = {
  audio: {
    base64: string;
    buffer: Buffer;
    format: AudioFormat;
    mimeType: string;
  };
  finishReason?: string | null;
  id?: string;
  model: string;
};

export type PresetSpeechInput = {
  format?: AudioFormat;
  instruction?: string;
  style?: string;
  text: string;
  voice?: string;
};

export type CloneSpeechInput = {
  format?: AudioFormat;
  instruction?: string;
  source: {
    base64: string;
    mimeType: string;
  };
  style?: string;
  text: string;
};

export type DesignSpeechInput = {
  format?: AudioFormat;
  prompt: string;
  text: string;
};

type RawChatResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      audio?: {
        data?: string;
      };
    };
  }>;
  error?: {
    message?: string;
  };
  id?: string;
  model?: string;
};

const baseUrl = "https://api.xiaomimimo.com/v1/";
const defaultFormat = "wav" satisfies AudioFormat;
const presetModel = "mimo-v2.5-tts";
const cloneModel = "mimo-v2.5-tts-voiceclone";
const designModel = "mimo-v2.5-tts-voicedesign";

export const requestJson = async <T>(
  env: Pick<Env, "TTS_API_KEY">,
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const signal = createRequestSignal(options);

  try {
    const response = await fetch(new URL(path, baseUrl), {
      headers: {
        "Content-Type": "application/json",
        "api-key": env.TTS_API_KEY,
      },
      method: "POST",
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
      ...(signal ? { signal: signal.signal } : {}),
    });

    const raw = await readJson(response);

    if (!response.ok) {
      throw new Error(readErrorMessage(raw, response.status));
    }

    return raw as T;
  } finally {
    signal?.dispose();
  }
};

export const createTtsApi = ({ env }: { env: Pick<Env, "TTS_API_KEY"> }) => ({
  clone: async (
    {
      format = defaultFormat,
      instruction,
      source,
      style,
      text,
    }: CloneSpeechInput,
    options?: BaseRequestOptions,
  ) => {
    const speechText = normalizeSpeechText(text);
    const raw = await requestJson<RawChatResponse>(env, "chat/completions", {
      body: {
        audio: {
          format,
          voice: `data:${source.mimeType};base64,${source.base64}`,
        },
        messages: [
          ...(instruction?.trim()
            ? [{ content: instruction.trim(), role: "user" as const }]
            : []),
          {
            content: style?.trim() ? `(${style.trim()})${speechText}` : speechText,
            role: "assistant",
          },
        ],
        model: cloneModel,
      },
      ...options,
    });

    return readSpeechResult(raw, {
      format,
      model: cloneModel,
    });
  },

  design: async (
    {
      format = defaultFormat,
      prompt,
      text,
    }: DesignSpeechInput,
    options?: BaseRequestOptions,
  ) => {
    const speechText = normalizeSpeechText(text);
    const designPrompt = prompt.trim();

    if (designPrompt.length === 0) {
      throw new Error("Voice design prompt must not be empty.");
    }

    const raw = await requestJson<RawChatResponse>(env, "chat/completions", {
      body: {
        audio: {
          format,
        },
        messages: [
          {
            content: designPrompt,
            role: "user",
          },
          {
            content: speechText,
            role: "assistant",
          },
        ],
        model: designModel,
      },
      ...options,
    });

    return readSpeechResult(raw, {
      format,
      model: designModel,
    });
  },

  preset: async (
    {
      format = defaultFormat,
      instruction,
      style,
      text,
      voice,
    }: PresetSpeechInput,
    options?: BaseRequestOptions,
  ) => {
    const speechText = normalizeSpeechText(text);
    const raw = await requestJson<RawChatResponse>(env, "chat/completions", {
      body: {
        audio: {
          format,
          voice: voice?.trim() || defaultPresetVoiceId,
        },
        messages: [
          ...(instruction?.trim()
            ? [{ content: instruction.trim(), role: "user" as const }]
            : []),
          {
            content: style?.trim() ? `(${style.trim()})${speechText}` : speechText,
            role: "assistant",
          },
        ],
        model: presetModel,
      },
      ...options,
    });

    return readSpeechResult(raw, {
      format,
      model: presetModel,
    });
  },
});

const normalizeSpeechText = (text: string) => {
  const speechText = text.trim();

  if (speechText.length === 0) {
    throw new Error("Speech text must not be empty.");
  }

  return speechText;
};

const readSpeechResult = (
  raw: RawChatResponse,
  {
    format,
    model,
  }: {
    format: AudioFormat;
    model: string;
  },
): TtsResult => {
  const base64 = raw.choices?.[0]?.message?.audio?.data;

  if (!base64) {
    throw new Error("Speech synthesis response does not contain audio data.");
  }

  return {
    audio: {
      base64,
      buffer: Buffer.from(base64, "base64"),
      format,
      mimeType: readMimeType(format),
    },
    ...(raw.choices?.[0]?.finish_reason !== undefined
      ? { finishReason: raw.choices[0].finish_reason }
      : {}),
    ...(raw.id !== undefined ? { id: raw.id } : {}),
    model: raw.model ?? model,
  };
};

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (text.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON response, received status ${response.status}.`);
  }
};

const readErrorMessage = (raw: unknown, status: number) => {
  if (raw && typeof raw === "object" && "error" in raw) {
    const error = (raw as RawChatResponse).error;

    if (error?.message) {
      return error.message;
    }
  }

  return `Request failed with status ${status}.`;
};

const readMimeType = (format: AudioFormat) => {
  if (format === "mp3") {
    return "audio/mpeg";
  }

  if (format === "ogg") {
    return "audio/ogg";
  }

  return "audio/wav";
};
