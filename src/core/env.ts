import dotenv from "dotenv";
import { z } from "zod";

const defaultTelegramMediaMaxBytes = 5_000_000;

const optionalString = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? undefined : trimmed;
};

const parseAdminIds = (value: unknown) => {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const envSchema = z.object({
  ADMIN_IDS: z.preprocess(
    parseAdminIds,
    z.array(z.coerce.number().int().positive()).catch([]),
  ),
  FFMPEG_PATH: z.preprocess(
    optionalString,
    z.string().trim().min(1).optional(),
  ),
  TELEGRAM_BOT_TOKEN: z.preprocess(
    optionalString,
    z.string().trim().min(1),
  ),
  TELEGRAM_MEDIA_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .catch(defaultTelegramMediaMaxBytes),
  TTS_API_KEY: z.preprocess(
    optionalString,
    z.string().trim().min(1),
  ),
  TTS_VOICE_SOURCES_DIR: z.preprocess(
    optionalString,
    z.string().trim().min(1),
  ),
});

export type Env = z.infer<typeof envSchema>;

export const loadEnv = () => {
  dotenv.config({
    quiet: true,
  });

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".") || "root"}: ${issue.message}`,
    );

    throw new Error(`Invalid environment variables:\n${lines.join("\n")}`);
  }

  return result.data;
};
