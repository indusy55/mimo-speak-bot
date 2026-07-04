import type { VoiceSourceFile } from "./transcoder.js";
import type { VoiceFileStore } from "./file-store.js";
import type {
  VoiceSourceRecord,
  VoiceSourceRepository,
} from "./repository.js";
import type { VoiceSourceUpload } from "./source.js";
import type { VoiceSourceTranscoder } from "./transcoder.js";

export type VoiceSource = {
  buffer: Buffer;
  mimeType: string;
  name: string;
};

export type SaveVoiceSourceResult = {
  path: string;
  replacedExisting: boolean;
  voiceName: string;
};

export type DeleteVoiceSourceResult = {
  deleted: boolean;
  voiceName: string;
};

export type VoiceSourceService = {
  delete: (voiceName: string) => Promise<DeleteVoiceSourceResult>;
  get: (voiceName: string) => Promise<VoiceSource | undefined>;
  list: () => Promise<Pick<VoiceSourceRecord, "name">[]>;
  save: (
    voiceName: string,
    file: VoiceSourceUpload,
  ) => Promise<SaveVoiceSourceResult>;
  validateName: (voiceName: string | undefined) => string | undefined;
};

export function createVoiceSourceService({
  fileStore,
  repository,
  transcoder,
}: {
  fileStore: VoiceFileStore;
  repository: VoiceSourceRepository;
  transcoder: VoiceSourceTranscoder;
}): VoiceSourceService {
  return {
    delete: async (voiceName) => {
      const normalizedName = normalizeVoiceName(voiceName);
      const existing = repository.findByName(normalizedName);

      if (!existing) {
        return { deleted: false, voiceName: voiceName.trim() };
      }

      repository.delete(normalizedName);
      await maybeDeleteFile(repository, fileStore, existing.hash);

      return { deleted: true, voiceName: existing.name };
    },

    get: async (voiceName) => {
      const existing = repository.findByName(voiceName);

      if (!existing) {
        return undefined;
      }

      return {
        buffer: await fileStore.read(existing.hash),
        mimeType: existing.mimeType,
        name: existing.name,
      };
    },

    list: async () =>
      repository.list().map((record) => ({ name: record.name })),

    save: async (voiceName, file) => {
      const validatedName = validateName(voiceName);

      if (!validatedName) {
        throw new Error("Invalid voice source name.");
      }

      const normalizedName = normalizeVoiceName(validatedName);
      const transcoded = await transcoder.transform(file);
      const hash = fileStore.hash(transcoded.buffer);

      const existing = repository.findByName(normalizedName);
      const previousHash = existing?.hash;
      const now = Date.now();

      if (existing) {
        repository.update(normalizedName, {
          fileSize: transcoded.buffer.byteLength,
          hash,
          mimeType: readMimeType(transcoded.extension),
          name: validatedName,
          normalizedName,
          updatedAt: now,
        });
      } else {
        repository.insert({
          createdAt: now,
          fileSize: transcoded.buffer.byteLength,
          hash,
          mimeType: readMimeType(transcoded.extension),
          name: validatedName,
          normalizedName,
          updatedAt: now,
        });
      }

      await fileStore.write(hash, transcoded.buffer);

      if (previousHash && previousHash !== hash) {
        await maybeDeleteFile(repository, fileStore, previousHash);
      }

      return {
        path: fileStore.resolvePath(hash),
        replacedExisting: existing !== undefined,
        voiceName: validatedName,
      };
    },

    validateName,
  };
}

async function maybeDeleteFile(
  repository: VoiceSourceRepository,
  fileStore: VoiceFileStore,
  hash: string,
) {
  if (repository.countByHash(hash) === 0) {
    await fileStore.delete(hash);
  }
}

function readMimeType(extension: string) {
  const normalized = extension.replace(/^\./, "");

  if (normalized === "mp3") {
    return "audio/mpeg";
  }

  if (normalized === "ogg") {
    return "audio/ogg";
  }

  return "audio/wav";
}

const invalidVoiceNamePattern = /[<>:"/\\|?*]/;

const windowsReservedNames = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

export function validateName(voiceName: string | undefined) {
  const normalizedName = voiceName?.trim();

  if (!normalizedName) {
    return undefined;
  }

  if (
    invalidVoiceNamePattern.test(normalizedName) ||
    hasControlCharacters(normalizedName)
  ) {
    return undefined;
  }

  if (windowsReservedNames.has(normalizedName.toLowerCase())) {
    return undefined;
  }

  if (normalizedName.endsWith(".") || normalizedName.endsWith(" ")) {
    return undefined;
  }

  return normalizedName;
}

function normalizeVoiceName(voiceName: string) {
  return voiceName.trim().toLowerCase();
}

function hasControlCharacters(value: string) {
  return Array.from(value).some((char) => {
    const codePoint = char.codePointAt(0);
    return codePoint !== undefined && codePoint >= 0 && codePoint <= 31;
  });
}
