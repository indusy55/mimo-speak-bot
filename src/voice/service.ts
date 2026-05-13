import type { VoiceSourceUpload } from "./source.js";
import type { VoiceSourceStore } from "./store.js";
import type { VoiceSourceTranscoder } from "./transcoder.js";

export type VoiceSourceService = {
  delete: (voiceName: string) => ReturnType<VoiceSourceStore["delete"]>;
  get: (voiceName: string) => ReturnType<VoiceSourceStore["get"]>;
  list: () => ReturnType<VoiceSourceStore["list"]>;
  save: (
    voiceName: string,
    file: VoiceSourceUpload,
  ) => ReturnType<VoiceSourceStore["save"]>;
  validateName: (voiceName: string | undefined) => string | undefined;
};

export const createVoiceSourceService = ({
  store,
  transcoder,
}: {
  store: VoiceSourceStore;
  transcoder: VoiceSourceTranscoder;
}): VoiceSourceService => ({
  delete: (voiceName: string) => store.delete(voiceName),
  get: (voiceName: string) => store.get(voiceName),
  list: () => store.list(),
  save: async (voiceName: string, file: VoiceSourceUpload) =>
    store.save(voiceName, await transcoder.transform(file)),
  validateName: (voiceName: string | undefined) => store.validateName(voiceName),
});
