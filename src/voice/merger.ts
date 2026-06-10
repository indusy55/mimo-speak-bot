import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { resolveFfmpegPath, toFfmpegError } from "./ffmpeg.js";

const execFileAsync = promisify(execFile);
const defaultGapMs = 600;
const targetSampleRate = 24000;

/**
 * Create a silent WAV buffer (PCM s16le mono) of the given duration.
 */
function createSilenceWav(durationMs: number, sampleRate: number): Buffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * 2; // 16-bit mono
  const fileSize = 44 + dataSize;
  const buffer = Buffer.alloc(fileSize, 0);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // fmt subchunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

/**
 * Merge multiple WAV audio clips into a single WAV, inserting silence gaps
 * between each clip.  All clips are resampled to PCM s16le 24kHz mono for
 * consistent output.
 */
export async function mergeAudioClips(
  clips: Buffer[],
  options?: { gapMs?: number; ffmpegPath?: string },
): Promise<Buffer> {
  const { gapMs = defaultGapMs, ffmpegPath } = options ?? {};

  if (clips.length === 0) {
    throw new Error("No audio clips to merge.");
  }

  if (clips.length === 1) {
    return clips[0]!;
  }

  const ffmpeg = resolveFfmpegPath(ffmpegPath);
  const tempDir = await mkdtemp(join(tmpdir(), "sp-bot-merge-"));

  try {
    const silence = createSilenceWav(gapMs, targetSampleRate);
    const segmentPaths: string[] = [];

    for (let i = 0; i < clips.length; i++) {
      const clipPath = join(tempDir, `clip${i}.wav`);
      await writeFile(clipPath, clips[i]!);
      segmentPaths.push(clipPath);

      if (i < clips.length - 1) {
        const silencePath = join(tempDir, `silence${i}.wav`);
        await writeFile(silencePath, silence);
        segmentPaths.push(silencePath);
      }
    }

    const outputPath = join(tempDir, "output.wav");
    const inputArgs = segmentPaths.flatMap((p) => ["-i", p]);
    const numInputs = segmentPaths.length;
    const filterInputs = Array.from({ length: numInputs }, (_, i) => `[${i}:a]`).join("");

    await execFileAsync(ffmpeg, [
      ...inputArgs,
      "-filter_complex",
      `${filterInputs}concat=n=${numInputs}:v=0:a=1`,
      "-ar",
      String(targetSampleRate),
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      outputPath,
    ]);

    const result = await readFile(outputPath);

    if (!result || result.byteLength === 0) {
      throw new Error("Merged audio is empty.");
    }

    return result;
  } catch (error) {
    throw toFfmpegError(error, "Failed to merge audio");
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}


