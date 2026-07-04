import type {
  SpeechModelV4,
  SpeechModelV4CallOptions,
  SpeechModelV4Result,
} from "@ai-sdk/provider";

const defaultBaseUrl = "https://api.xiaomimimo.com/v1";

export type MiMoModelId =
  | "mimo-v2.5-tts"
  | "mimo-v2.5-tts-voicedesign"
  | "mimo-v2.5-tts-voiceclone";

export class MimoModel implements SpeechModelV4 {
  readonly specificationVersion = "v4" as const;
  readonly provider = "mimo-tts";
  readonly modelId: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(modelId: MiMoModelId, apiKey: string, baseUrl?: string) {
    this.modelId = modelId;
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? defaultBaseUrl).replace(/\/$/, "");
  }

  async doGenerate(
    options: SpeechModelV4CallOptions,
  ): Promise<SpeechModelV4Result> {
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    if (options.instructions) {
      messages.push({ role: "user", content: options.instructions });
    }

    messages.push({ role: "assistant", content: options.text });

    const audioParams: Record<string, unknown> = {
      format: options.outputFormat ?? "wav",
    };

    if (options.voice) {
      audioParams.voice = options.voice;
    }

    const body: Record<string, unknown> = {
      model: this.modelId,
      messages,
      audio: audioParams,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
        ...options.headers,
      },
      body: JSON.stringify(body),
      signal: options.abortSignal ?? null,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      throw new Error(`MiMo TTS API error (${response.status}): ${errorBody}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          audio?: { data?: string };
        };
      }>;
    };

    const audioBase64 = json.choices?.[0]?.message?.audio?.data;

    if (!audioBase64) {
      throw new Error("MiMo TTS API returned no audio data");
    }

    return {
      audio: audioBase64,
      warnings: [],
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: Object.fromEntries(response.headers.entries()),
      },
    };
  }
}
