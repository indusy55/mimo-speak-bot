import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type VoiceFileStore = {
  delete: (hash: string) => Promise<void>;
  hash: (buffer: Buffer) => string;
  read: (hash: string) => Promise<Buffer>;
  resolvePath: (hash: string) => string;
  write: (hash: string, buffer: Buffer) => Promise<string>;
};

export function createVoiceFileStore({
  dir,
  extension = ".wav",
}: {
  dir: string;
  extension?: string;
}): VoiceFileStore {
  return {
    delete: async (hash) => {
      await rm(resolvePath(dir, hash, extension), { force: true });
    },

    hash: (buffer) => createHash("sha256").update(buffer).digest("hex"),

    read: async (hash) => readFile(resolvePath(dir, hash, extension)),

    resolvePath: (hash) => resolvePath(dir, hash, extension),

    write: async (hash, buffer) => {
      const path = resolvePath(dir, hash, extension);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, buffer);
      return path;
    },
  };
}

function resolvePath(dir: string, hash: string, extension: string) {
  return join(
    dir,
    hash.slice(0, 2),
    hash.slice(2, 4),
    `${hash}${extension}`,
  );
}
