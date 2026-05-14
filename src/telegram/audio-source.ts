import type { Message } from "grammy/types";
import type { Env } from "../core/env.js";
import {
  createRequestSignal,
  type RequestOptions,
} from "../core/request.js";
import {
  assertVoiceSourceSize,
  readVoiceSourceExtension,
  readVoiceSourceInfo,
  readVoiceSourceMimeType,
  type VoiceSourceExtension,
} from "../voice/source.js";
import type { TelegramFiles } from "./files.js";

export type TelegramAudioUpload = {
  extension: VoiceSourceExtension;
  fileId: string;
  fileSize?: number;
  mimeType: string;
  source: "audio" | "document" | "video" | "voice";
};

export type DownloadedTelegramAudio = {
  buffer: Buffer;
  extension: VoiceSourceExtension;
  mimeType: string;
  source: TelegramAudioUpload["source"];
};

export type TelegramAudioSource = {
  download: (
    message: Message,
    options?: RequestOptions,
  ) => Promise<DownloadedTelegramAudio>;
  readUpload: (message: Message) => TelegramAudioUpload | undefined;
};

export function createTelegramAudioSource({
  env,
  files,
}: {
  env: Pick<Env, "TELEGRAM_MEDIA_MAX_BYTES">;
  files: TelegramFiles;
}): TelegramAudioSource {
  return {
    download: async (message, options) => {
      const upload = readUpload(message);

      if (!upload) {
        throw new Error(
          "Please send a voice message, audio file, or common audio/video document.",
        );
      }

      const meta = await files.meta(upload.fileId);
      assertVoiceSourceSize(
        upload.fileSize ?? meta.fileSize,
        env.TELEGRAM_MEDIA_MAX_BYTES,
      );

      const buffer = await downloadAudio(
        files,
        upload.fileId,
        meta.filePath,
        options,
      );

      if (buffer.byteLength === 0) {
        throw new Error("The uploaded audio file is empty.");
      }

      assertVoiceSourceSize(buffer.byteLength, env.TELEGRAM_MEDIA_MAX_BYTES);

      const info = await readVoiceSourceInfo({
        buffer,
        extension: upload.extension,
        mimeType: upload.mimeType,
      });

      return {
        buffer,
        extension: info.extension,
        mimeType: info.mimeType,
        source: upload.source,
      };
    },
    readUpload,
  };
}

async function downloadAudio(
  files: TelegramFiles,
  fileId: string,
  filePath: string,
  options?: RequestOptions,
) {
  const signal = createRequestSignal(options ?? {});

  try {
    const response = await fetch(files.fileUrl(filePath), {
      ...(signal ? { signal: signal.signal } : {}),
    });

    if (response.ok) {
      return Buffer.from(await response.arrayBuffer());
    }

    const refreshed = await files.meta(fileId, {
      forceRefresh: true,
    });
    const retried = await fetch(files.fileUrl(refreshed.filePath), {
      ...(signal ? { signal: signal.signal } : {}),
    });

    if (!retried.ok) {
      throw new Error("Failed to download the audio file from Telegram.");
    }

    return Buffer.from(await retried.arrayBuffer());
  } finally {
    signal?.dispose();
  }
}

function readUpload(message: Message): TelegramAudioUpload | undefined {
  for (const upload of readUploadCandidates(message)) {
    if (upload) {
      return upload;
    }
  }

  return undefined;
}

function* readUploadCandidates(
  message: Message,
): Generator<TelegramAudioUpload | undefined> {
  yield readVoiceUpload(message);
  yield readAudioUpload(message);
  yield readDocumentUpload(message);
  yield readVideoUpload(message);
}

function readVoiceUpload(message: Message): TelegramAudioUpload | undefined {
  if (!("voice" in message) || !message.voice) {
    return undefined;
  }

  return {
    extension: ".ogg",
    fileId: message.voice.file_id,
    ...(message.voice.file_size ? { fileSize: message.voice.file_size } : {}),
    mimeType: message.voice.mime_type ?? "audio/ogg",
    source: "voice",
  };
}

function readAudioUpload(message: Message): TelegramAudioUpload | undefined {
  if (!("audio" in message) || !message.audio) {
    return undefined;
  }

  return readFileUpload({
    fileId: message.audio.file_id,
    ...(message.audio.file_name ? { fileName: message.audio.file_name } : {}),
    ...(message.audio.file_size ? { fileSize: message.audio.file_size } : {}),
    ...(message.audio.mime_type ? { mimeType: message.audio.mime_type } : {}),
    source: "audio",
  });
}

function readDocumentUpload(
  message: Message,
): TelegramAudioUpload | undefined {
  if (!("document" in message) || !message.document) {
    return undefined;
  }

  return readFileUpload({
    fileId: message.document.file_id,
    ...(message.document.file_name
      ? { fileName: message.document.file_name }
      : {}),
    ...(message.document.file_size
      ? { fileSize: message.document.file_size }
      : {}),
    ...(message.document.mime_type
      ? { mimeType: message.document.mime_type }
      : {}),
    source: "document",
  });
}

function readVideoUpload(message: Message): TelegramAudioUpload | undefined {
  if (!("video" in message) || !message.video) {
    return undefined;
  }

  return readFileUpload({
    fileId: message.video.file_id,
    ...(message.video.file_name ? { fileName: message.video.file_name } : {}),
    ...(message.video.file_size ? { fileSize: message.video.file_size } : {}),
    ...(message.video.mime_type ? { mimeType: message.video.mime_type } : {}),
    source: "video",
  });
}

function readFileUpload({
  fileId,
  fileName,
  fileSize,
  mimeType,
  source,
}: {
  fileId: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  source: TelegramAudioUpload["source"];
}): TelegramAudioUpload | undefined {
  const extension = readVoiceSourceExtension({
    ...(fileName ? { fileName } : {}),
    ...(mimeType ? { mimeType } : {}),
  });

  if (!extension) {
    return undefined;
  }

  return {
    extension,
    fileId,
    ...(fileSize ? { fileSize } : {}),
    mimeType: mimeType ?? readVoiceSourceMimeType(extension),
    source,
  };
}
