import type { RequestOptions } from "../core/request.js";
import type { TtsResult, createTtsApi } from "./api.js";
import type { VoiceSourceStore } from "../voice/store.js";

type TtsApi = ReturnType<typeof createTtsApi>;

export type SpeakInput = {
  instruction?: string;
  style?: string;
  text: string;
  voice?: string;
};

export type DesignInput = {
  prompt: string;
  text: string;
};

export type TtsService = {
  clone: (input: SpeakInput, options?: RequestOptions) => Promise<TtsResult>;
  design: (input: DesignInput, options?: RequestOptions) => Promise<TtsResult>;
  preset: (input: SpeakInput, options?: RequestOptions) => Promise<TtsResult>;
};

export const createTtsService = ({
  api,
  voiceSources,
}: {
  api: TtsApi;
  voiceSources: VoiceSourceStore;
}): TtsService => ({
  clone: async ({ instruction, style, text, voice }, options) => {
    const voiceSource = voice ? await voiceSources.get(voice) : undefined;

    if (!voiceSource) {
      throw new Error("No voice source is configured.");
    }

    return api.clone(
      {
        ...(instruction ? { instruction } : {}),
        source: {
          base64: voiceSource.base64,
          mimeType: voiceSource.mimeType,
        },
        ...(style ? { style } : {}),
        text,
      },
      options,
    );
  },

  design: ({ prompt, text }, options) =>
    api.design(
      {
        prompt,
        text,
      },
      options,
    ),

  preset: ({ instruction, style, text, voice }, options) =>
    api.preset(
      {
        ...(instruction ? { instruction } : {}),
        ...(style ? { style } : {}),
        text,
        ...(voice ? { voice } : {}),
      },
      options,
    ),
});
