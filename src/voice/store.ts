import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { Env } from "../core/env.js";
import { readVoiceSourceMimeType, storedVoiceSourceExtensions } from "./source.js";
import type { VoiceSourceFile } from "./transcoder.js";

const invalidVoiceNamePattern = /[<>:"/\\|?*]/;

export type VoiceSourceRecord = {
  name: string;
  path: string;
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

export type StoredVoiceSource = {
  base64: string;
  mimeType: string;
  name: string;
};

export type VoiceSourceStore = {
  delete: (voiceName: string) => Promise<DeleteVoiceSourceResult>;
  get: (voiceName: string) => Promise<StoredVoiceSource | undefined>;
  list: () => Promise<VoiceSourceRecord[]>;
  save: (
    voiceName: string,
    file: VoiceSourceFile,
  ) => Promise<SaveVoiceSourceResult>;
  validateName: (voiceName: string | undefined) => string | undefined;
};

type VoiceSourceEntry = {
  filePath: string;
  name: string;
  normalizedName: string;
};

export function createVoiceSourceStore({
  env,
}: {
  env: Pick<Env, "TTS_VOICE_SOURCES_DIR">;
}): VoiceSourceStore {
  const dir = env.TTS_VOICE_SOURCES_DIR.trim();

  return {
    delete: async (voiceName) => {
      const normalizedName = normalizeVoiceName(voiceName);
      const deleted = await removeExistingFiles(dir, normalizedName);

      return {
        deleted,
        voiceName: voiceName.trim(),
      };
    },
    get: async (voiceName) => {
      const normalizedName = normalizeVoiceName(voiceName);
      const entries = await readEntries(dir);
      const matched = entries.find(
        (entry) => entry.normalizedName === normalizedName,
      );

      if (!matched) {
        return undefined;
      }

      const extension = extname(matched.filePath).toLowerCase();

      return {
        base64: (await readFile(matched.filePath)).toString("base64"),
        mimeType: readVoiceSourceMimeType(extension),
        name: matched.name,
      };
    },
    list: async () => {
      const entries = await readEntries(dir);
      return entries.map((entry) => ({
        name: entry.name,
        path: entry.filePath,
      }));
    },
    save: async (voiceName, file) => {
      const validatedName = voiceName.trim();
      const normalizedName = normalizeVoiceName(validatedName);

      await mkdir(dir, {
        recursive: true,
      });

      const replacedExisting = await removeExistingFiles(dir, normalizedName);
      const path = join(dir, `${validatedName}${file.extension}`);

      await writeFile(path, file.buffer);

      return {
        path,
        replacedExisting,
        voiceName: validatedName,
      };
    },
    validateName,
  };
}

async function readEntries(dir: string) {
  let entries: Dirent<string>[];

  try {
    entries = await readdir(dir, {
      withFileTypes: true,
    });
  } catch (error) {
    if (isMissing(error)) {
      return [];
    }

    throw error;
  }

  const records = entries
    .filter((entry) => entry.isFile())
    .flatMap((entry) => {
      const extension = extname(entry.name).toLowerCase();

      if (!storedVoiceSourceExtensions.has(extension)) {
        return [];
      }

      const name = basename(entry.name, extension).trim();

      if (name.length === 0) {
        return [];
      }

      return [
        {
          filePath: join(dir, entry.name),
          name,
          normalizedName: normalizeVoiceName(name),
        },
      ];
    })
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

  const deduped = new Map<string, VoiceSourceEntry>();

  for (const record of records) {
    if (!deduped.has(record.normalizedName)) {
      deduped.set(record.normalizedName, record);
    }
  }

  return [...deduped.values()];
}

async function removeExistingFiles(dir: string, normalizedName: string) {
  const entries = await readEntries(dir);
  let removed = false;

  for (const entry of entries) {
    if (entry.normalizedName !== normalizedName) {
      continue;
    }

    await rm(entry.filePath, {
      force: true,
    });
    removed = true;
  }

  return removed;
}

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

  if (normalizedName.endsWith(".") || normalizedName.endsWith(" ")) {
    return undefined;
  }

  return normalizedName;
}

function normalizeVoiceName(voiceName: string) {
  return voiceName.trim().toLocaleLowerCase();
}

function hasControlCharacters(value: string) {
  return Array.from(value).some((char) => {
    const codePoint = char.codePointAt(0);
    return codePoint !== undefined && codePoint >= 0 && codePoint <= 31;
  });
}

function isMissing(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
