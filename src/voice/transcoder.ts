import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  readVoiceSourceInfo,
  storedVoiceSourceExtensions,
  type VoiceSourceUpload,
} from "./source.js";

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

export const createVoiceSourceTranscoder = ({
  ffmpegPath,
}: {
  ffmpegPath?: string;
} = {}): VoiceSourceTranscoder => ({
  transform: async (file) => {
    const info = await readVoiceSourceInfo(file);
    const extension = normalizeExtension(info.extension);
    const shouldTrim =
      info.durationSeconds !== undefined &&
      info.durationSeconds > maxVoiceSourceSeconds;

    if (storedVoiceSourceExtensions.has(extension) && !shouldTrim) {
      return {
        buffer: file.buffer,
        extension: extension as VoiceSourceFile["extension"],
      };
    }

    return transcodeToWav({
      buffer: file.buffer,
      extension,
      ffmpegPath: resolveFfmpegPath(ffmpegPath),
      maxSeconds: maxVoiceSourceSeconds,
    });
  },
});

const transcodeToWav = async ({
  buffer,
  extension,
  ffmpegPath,
  maxSeconds,
}: {
  buffer: Buffer;
  extension: string;
  ffmpegPath: string;
  maxSeconds: number;
}): Promise<VoiceSourceFile> => {
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
    throw toTranscodeError(error);
  } finally {
    await removeTempDir(tempDir);
  }
};

const removeTempDir = async (tempDir: string) => {
  try {
    await rm(tempDir, {
      force: true,
      recursive: true,
    });
  } catch {
    // Best-effort cleanup for temporary transform files.
  }
};

const normalizeExtension = (extension: string) => {
  const normalized = extension.trim().toLowerCase();
  return normalized.length > 0 ? normalized : ".bin";
};

const resolveFfmpegPath = (ffmpegPath?: string) => {
  const configured = ffmpegPath?.trim();

  if (configured) {
    return configured;
  }

  return process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
};

const toTranscodeError = (error: unknown) => {
  const stderr =
    error instanceof Error && "stderr" in error && typeof error.stderr === "string"
      ? error.stderr
      : undefined;
  const summarized = stderr ? summarizeFfmpegStderr(stderr) : undefined;

  if (summarized) {
    return new Error(summarized);
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new Error(
      `Failed to transform voice source: ${truncateText(error.message)}`,
    );
  }

  return new Error("Failed to transform voice source.");
};

const summarizeFfmpegStderr = (stderr: string) => {
  const normalized = stderr.trim();

  if (normalized.length === 0) {
    return undefined;
  }

  if (
    normalized.includes("Stream map '0:a:0' matches no streams") ||
    normalized.includes("Output file #0 does not contain any stream")
  ) {
    return "Failed to transform voice source: no audio track was found.";
  }

  if (
    normalized.includes("Invalid data found when processing input") ||
    normalized.includes("moov atom not found")
  ) {
    return "Failed to transform voice source: the file is damaged or not a supported media format.";
  }

  const meaningfulLine = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("["));

  return meaningfulLine
    ? `Failed to transform voice source: ${truncateText(meaningfulLine)}`
    : "Failed to transform voice source.";
};

const truncateText = (value: string, maxLength = 160) => {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
};
