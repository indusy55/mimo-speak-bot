import { Buffer } from "node:buffer";
import type { VoiceSourceService } from "../voice/service.js";
import { MimoModel, type MiMoModelId } from "./mimo-model.js";

export type SpeechMode = "clone" | "design" | "preset";

export type SpeechInput = {
  instruction?: string;
  mode: SpeechMode;
  outputFormat?: AudioFormat;
  text: string;
  voice: string;
};

export type SpeechResult = {
  buffer: Buffer;
  format: AudioFormat;
  mimeType: string;
};

export type AudioFormat = "mp3" | "ogg" | "wav";

export type SpeechService = {
  synthesize: (input: SpeechInput) => Promise<SpeechResult>;
};

type MimoModelConfig = {
  apiKey: string;
  baseUrl?: string;
};

const modelIds: Record<SpeechMode, MiMoModelId> = {
  clone: "mimo-v2.5-tts-voiceclone",
  design: "mimo-v2.5-tts-voicedesign",
  preset: "mimo-v2.5-tts",
};

export function createSpeechService({
  apiKey,
  baseUrl,
  voiceSources,
}: MimoModelConfig & {
  voiceSources: VoiceSourceService;
}): SpeechService {
  return {
    synthesize: async (input) => {
      const model = new MimoModel(
        modelIds[input.mode],
        apiKey,
        baseUrl,
      );

      const voice = await resolveVoice(input.mode, input.voice, voiceSources);

      const result = await model.doGenerate({
        text: input.text,
        outputFormat: input.outputFormat ?? "wav",
        ...(voice ? { voice } : {}),
        ...(input.instruction !== undefined
          ? { instructions: input.instruction }
          : {}),
      });

      const audioBytes =
        typeof result.audio === "string"
          ? Buffer.from(result.audio, "base64")
          : Buffer.from(result.audio);

      const format = (input.outputFormat as AudioFormat) ?? "wav";

      return {
        buffer: audioBytes,
        format,
        mimeType: readMimeType(format),
      };
    },
  };
}

async function resolveVoice(
  mode: SpeechMode,
  voice: string,
  voiceSources: VoiceSourceService,
) {
  if (mode !== "clone") {
    return voice;
  }

  if (!voice) {
    return undefined;
  }

  const source = await voiceSources.get(voice);

  if (!source) {
    throw new Error(`Voice source "${voice}" not found.`);
  }

  return `data:${source.mimeType};base64,${source.buffer.toString("base64")}`;
}

function readMimeType(format: AudioFormat) {
  if (format === "mp3") {
    return "audio/mpeg";
  }

  if (format === "ogg") {
    return "audio/ogg";
  }

  return "audio/wav";
}
