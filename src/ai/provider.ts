import { customProvider } from "ai";
import type { SpeechModelV3 } from "@ai-sdk/provider";

export type MimoTtsMode = "clone" | "design" | "preset";

export type MimoTtsProviderOptions = {
  source?: string;
  style?: string;
};

export type MimoTtsConfig = {
  apiKey: string;
  baseUrl?: string;
};

const defaultBaseUrl = "https://api.xiaomimimo.com/v1";

const modelIds: Record<MimoTtsMode, string> = {
  clone: "mimo-v2.5-tts-voiceclone",
  design: "mimo-v2.5-tts-voicedesign",
  preset: "mimo-v2.5-tts",
};

export function createMimoTtsProvider({ apiKey, baseUrl }: MimoTtsConfig) {
  const resolvedBaseUrl = (baseUrl ?? defaultBaseUrl).replace(/\/$/, "");

  return customProvider({
    speechModels: {
      clone: new MimoSpeechModel({ apiKey, baseUrl: resolvedBaseUrl, mode: "clone" }),
      design: new MimoSpeechModel({ apiKey, baseUrl: resolvedBaseUrl, mode: "design" }),
      preset: new MimoSpeechModel({ apiKey, baseUrl: resolvedBaseUrl, mode: "preset" }),
    },
  });
}

type MimoSpeechModelConfig = {
  apiKey: string;
  baseUrl: string;
  mode: MimoTtsMode;
};

class MimoSpeechModel implements SpeechModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "mimo-tts";
  readonly modelId: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly mode: MimoTtsMode;

  constructor({ apiKey, baseUrl, mode }: MimoSpeechModelConfig) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.mode = mode;
    this.modelId = modelIds[mode];
  }

  async doGenerate(
    options: Parameters<SpeechModelV3["doGenerate"]>[0],
  ): Promise<Awaited<ReturnType<SpeechModelV3["doGenerate"]>>> {
    const {
      text,
      voice,
      instructions,
      outputFormat = "wav",
      abortSignal,
      providerOptions,
    } = options;

    const mimoOptions = providerOptions?.["mimo-tts"] as
      | MimoTtsProviderOptions
      | undefined;

    const requestBody = buildRequestBody({
      mode: this.mode,
      model: this.modelId,
      text,
      voice,
      instructions,
      outputFormat,
      source: mimoOptions?.source,
      style: mimoOptions?.style,
    });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      body: JSON.stringify(requestBody),
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      method: "POST",
      ...(abortSignal ? { signal: abortSignal } : {}),
    });

    const raw = (await readJson(response)) as RawChatResponse;

    if (!response.ok) {
      throw new Error(readErrorMessage(raw, response.status));
    }

    const base64 = raw.choices?.[0]?.message?.audio?.data;

    if (!base64) {
      throw new Error("Speech synthesis response does not contain audio data.");
    }

    return {
      audio: Uint8Array.from(Buffer.from(base64, "base64")),
      response: {
        body: raw,
        modelId: raw.model ?? this.modelId,
        timestamp: new Date(),
      },
      warnings: [],
    };
  }
}

function buildRequestBody({
  mode,
  model,
  text,
  voice,
  instructions,
  outputFormat,
  source,
  style,
}: {
  mode: MimoTtsMode;
  model: string;
  text: string;
  voice: string | undefined;
  instructions: string | undefined;
  outputFormat: string;
  source: string | undefined;
  style: string | undefined;
}) {
  const messages: Array<{ content: string; role: "assistant" | "user" }> = [];

  if (instructions?.trim()) {
    messages.push({ content: instructions.trim(), role: "user" });
  }

  if (mode === "design") {
    messages.push({ content: (voice ?? "").trim(), role: "user" });
  }

  const speechText = text.trim();
  const styledText = style?.trim()
    ? `(${style.trim()})${speechText}`
    : speechText;

  messages.push({ content: styledText, role: "assistant" });

  const audio: Record<string, string> = { format: outputFormat };

  if (mode === "clone") {
    audio.voice = source ?? "";
  } else if (mode === "preset") {
    audio.voice = voice?.trim() || "mimo_default";
  }

  return {
    audio,
    messages,
    model,
  };
}

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

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON response, received status ${response.status}.`);
  }
}

function readErrorMessage(raw: unknown, status: number) {
  if (raw && typeof raw === "object" && "error" in raw) {
    const error = (raw as RawChatResponse).error;

    if (error?.message) {
      return error.message;
    }
  }

  return `Request failed with status ${status}.`;
}
