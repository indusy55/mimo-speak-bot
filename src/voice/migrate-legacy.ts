import { readFile, readdir, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import type { VoiceFileStore } from "./file-store.js";
import type { VoiceSourceRepository } from "./repository.js";
import { validateName } from "./service.js";

const mimeMap: Record<string, string> = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
};

export async function migrateLegacyVoiceSources({
  dir,
  fileStore,
  repository,
}: {
  dir: string;
  fileStore: VoiceFileStore;
  repository: VoiceSourceRepository;
}): Promise<number> {
  let entries: string[];

  try {
    entries = await readdir(dir);
  } catch {
    return 0;
  }

  let migrated = 0;

  for (const entry of entries) {
    const ext = extname(entry).toLowerCase();
    const mimeType = mimeMap[ext];

    if (!mimeType) {
      continue;
    }

    const name = entry.slice(0, -ext.length).trim();
    const validatedName = validateName(name);

    if (!validatedName) {
      continue;
    }

    const normalizedName = validatedName.toLowerCase();

    if (repository.findByName(normalizedName)) {
      continue;
    }

    const sourcePath = join(dir, entry);
    const buffer = await readFile(sourcePath);
    const hash = fileStore.hash(buffer);
    const now = Date.now();

    repository.insert({
      createdAt: now,
      fileSize: buffer.byteLength,
      hash,
      mimeType,
      name: validatedName,
      normalizedName,
      updatedAt: now,
    });

    await fileStore.write(hash, buffer);
    await rm(sourcePath, { force: true });
    migrated += 1;
  }

  return migrated;
}
