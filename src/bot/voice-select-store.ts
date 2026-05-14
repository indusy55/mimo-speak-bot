import { randomUUID } from "node:crypto";

export type VoiceSelectPayload = {
  instruction?: string;
  replyToMessageId?: number;
  style?: string;
  text: string;
};

export type VoiceSelectStore = {
  read: (id: string) => VoiceSelectPayload | undefined;
  save: (payload: VoiceSelectPayload) => string;
};

const maxEntries = 200;

export function createVoiceSelectStore(): VoiceSelectStore {
  const entries = new Map<string, VoiceSelectPayload>();

  return {
    read: (id) => entries.get(id),
    save: (payload) => {
      const id = randomUUID();
      entries.set(id, payload);

      if (entries.size > maxEntries) {
        const firstKey = entries.keys().next().value as string | undefined;

        if (firstKey) {
          entries.delete(firstKey);
        }
      }

      return id;
    },
  };
}
