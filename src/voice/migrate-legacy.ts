import { readFile, readdir, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import type { VoiceFileStore } from "./file-store.js";
import type { VoiceSourceRepository } from "./repository.js";
import { validateName } from "./service.js";

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
    if (extname(entry).toLowerCase() !== ".wav") {
      continue;
    }

    const name = entry.slice(0, -".wav".length).trim();
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
      mimeType: "audio/wav",
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
