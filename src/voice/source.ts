import { extname } from "node:path";
import mime from "mime";
import { parseBuffer } from "music-metadata";

export const storedVoiceSourceExtensions = new Set([
  ".m4a",
  ".mp3",
  ".ogg",
  ".wav",
]);

const uploadMimeTypes = new Set([
  "application/ogg",
  "audio/3gpp",
  "audio/aac",
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/webm",
  "audio/x-flac",
  "audio/x-m4a",
  "audio/x-ms-wma",
  "audio/x-wav",
  "video/3gpp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo",
]);

export type VoiceSourceExtension = string;

export type VoiceSourceUpload = {
  buffer: Buffer;
  extension: VoiceSourceExtension;
  mimeType: string;
};

export type VoiceSourceInfo = {
  codec?: string;
  container?: string;
  durationSeconds?: number;
  extension: VoiceSourceExtension;
  hasAudio: boolean;
  hasVideo: boolean;
  mimeType: string;
};

export function readVoiceSourceExtension({
  fileName,
  mimeType,
}: {
  fileName?: string;
  mimeType?: string;
}): VoiceSourceExtension | undefined {
  const fromName = fileName ? extname(fileName.trim().toLowerCase()) : "";

  if (fromName) {
    return fromName;
  }

  if (!mimeType || !uploadMimeTypes.has(mimeType.trim().toLowerCase())) {
    return undefined;
  }

  const mimeExtension = mime.getExtension(mimeType);

  if (mimeExtension) {
    return `.${mimeExtension}`;
  }

  return readKnownExtension(mimeType);
}

export function readVoiceSourceMimeType(extension: VoiceSourceExtension) {
  return mime.getType(extension) ?? "application/octet-stream";
}

export async function assertVoiceSourceBuffer(
  buffer: Buffer,
  mimeType: string,
) {
  await readVoiceSourceInfo({
    buffer,
    extension: readVoiceSourceExtension({ mimeType }) ?? ".bin",
    mimeType,
  });
}

export async function readVoiceSourceInfo({
  buffer,
  extension,
  mimeType,
}: VoiceSourceUpload): Promise<VoiceSourceInfo> {
  try {
    const metadata = await parseBuffer(buffer, mimeType, {
      duration: true,
      skipCovers: true,
    });
    const hasAudio =
      metadata.format.hasAudio === true ||
      metadata.format.numberOfChannels !== undefined ||
      metadata.format.sampleRate !== undefined ||
      metadata.format.codec !== undefined ||
      metadata.format.trackInfo.some((track) => track.audio !== undefined);

    if (!hasAudio) {
      throw new Error("The uploaded media file does not contain an audio track.");
    }

    return {
      ...(metadata.format.codec ? { codec: metadata.format.codec } : {}),
      ...(metadata.format.container
        ? { container: metadata.format.container }
        : {}),
      ...(metadata.format.duration !== undefined
        ? { durationSeconds: metadata.format.duration }
        : {}),
      extension,
      hasAudio,
      hasVideo:
        metadata.format.hasVideo === true ||
        metadata.format.trackInfo.some((track) => track.video !== undefined),
      mimeType,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read media metadata: ${error.message}`);
    }

    throw new Error("Failed to read media metadata.");
  }
}

export function assertVoiceSourceSize(
  fileSize: number | undefined,
  maxBytes: number,
) {
  if (fileSize !== undefined && fileSize > maxBytes) {
    throw new Error(
      `Voice source file is too large. Maximum allowed size is ${maxBytes} bytes.`,
    );
  }
}

function readKnownExtension(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();

  if (normalized === "audio/x-m4a") {
    return ".m4a";
  }

  if (normalized === "audio/x-wav" || normalized === "audio/wave") {
    return ".wav";
  }

  if (normalized === "video/quicktime") {
    return ".mov";
  }

  if (normalized === "video/x-matroska") {
    return ".mkv";
  }

  if (normalized === "video/x-msvideo") {
    return ".avi";
  }

  return undefined;
}
