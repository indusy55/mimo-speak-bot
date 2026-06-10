import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  readVoiceSourceInfo,
  type VoiceSourceUpload,
} from "./source.js";
import { resolveFfmpegPath, toFfmpegError } from "./ffmpeg.js";

const execFileAsync = promisify(execFile);
const outputExtension = ".wav";
const maxVoiceSourceSeconds = 120;

export type VoiceSourceFile = {
  buffer: Buffer;
  extension: ".m4a" | ".mp3" | ".ogg" | ".wav";
};

export type VoiceSourceTranscoder = {
  transform: (file: VoiceSourceUpload) => Promise<VoiceSourceFile>;
};

export function createVoiceSourceTranscoder({
  ffmpegPath,
}: {
  ffmpegPath?: string;
} = {}): VoiceSourceTranscoder {
  return {
    transform: async (file) => {
      const info = await readVoiceSourceInfo(file);
      const extension = normalizeExtension(info.extension);
      // MIMO API 未明确文档支持的音频编码，且已知即使常见格式（如 mp3）
      // 也可能存在兼容问题。统一转码为 WAV（PCM s16le 24kHz 单声道）以确保兼容。
      return transcodeToWav({
        buffer: file.buffer,
        extension,
        ffmpegPath: resolveFfmpegPath(ffmpegPath),
        maxSeconds: maxVoiceSourceSeconds,
      });
    },
  };
}

async function transcodeToWav({
  buffer,
  extension,
  ffmpegPath,
  maxSeconds,
}: {
  buffer: Buffer;
  extension: string;
  ffmpegPath: string;
  maxSeconds: number;
}): Promise<VoiceSourceFile> {
  const tempDir = await mkdtemp(join(tmpdir(), "sp-bot-voice-source-"));
  const inputPath = join(tempDir, `input${extension}`);
  const outputPath = join(tempDir, `output${outputExtension}`);

  try {
    await writeFile(inputPath, buffer);
    await execFileAsync(ffmpegPath, [
      "-v",
      "error",
      "-y",
      "-i",
      inputPath,
      "-t",
      String(maxSeconds),
      "-map",
      "0:a:0",
      "-vn",
      "-codec:a",
      "pcm_s16le",
      "-ar",
      "24000",
      "-ac",
      "1",
      outputPath,
    ]);

    const outputBuffer = await readFile(outputPath);

    if (outputBuffer.byteLength === 0) {
      throw new Error("The transformed voice source is empty.");
    }

    return {
      buffer: outputBuffer,
      extension: outputExtension,
    };
  } catch (error) {
    throw toFfmpegError(error, "Failed to transform voice source");
  } finally {
    await removeTempDir(tempDir);
  }
}

async function removeTempDir(tempDir: string) {
  try {
    await rm(tempDir, {
      force: true,
      recursive: true,
    });
  } catch {
    // Best-effort cleanup for temporary transform files.
  }
}

function normalizeExtension(extension: string) {
  const normalized = extension.trim().toLowerCase();
  return normalized.length > 0 ? normalized : ".bin";
}
