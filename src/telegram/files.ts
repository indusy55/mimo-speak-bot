import type { Api } from "grammy";
import type { Env } from "../core/env.js";

export type TelegramFileMeta = {
  filePath: string;
  fileSize?: number;
};

export type TelegramFiles = {
  fileUrl: (filePath: string) => string;
  meta: (
    fileId: string,
    options?: { forceRefresh?: boolean },
  ) => Promise<TelegramFileMeta>;
};

type CacheEntry = {
  expiresAt: number;
  meta: TelegramFileMeta;
};

const cacheTtlMs = 55 * 60 * 1000;

export const createTelegramFiles = ({
  api,
  env,
}: {
  api: Api;
  env: Pick<Env, "TELEGRAM_BOT_TOKEN">;
}): TelegramFiles => {
  const cache = new Map<string, CacheEntry>();

  return {
    fileUrl: (filePath) =>
      `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`,

    meta: async (fileId, options) => {
      const cached = cache.get(fileId);

      if (
        options?.forceRefresh !== true &&
        cached !== undefined &&
        cached.expiresAt > Date.now()
      ) {
        return cached.meta;
      }

      const file = await api.getFile(fileId);

      if (!file.file_path) {
        throw new Error(`Telegram file path is missing for ${fileId}.`);
      }

      const meta = {
        filePath: file.file_path,
        ...(file.file_size !== undefined ? { fileSize: file.file_size } : {}),
      };

      cache.set(fileId, {
        expiresAt: Date.now() + cacheTtlMs,
        meta,
      });

      return meta;
    },
  };
};
