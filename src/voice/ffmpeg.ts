/**
 * Shared ffmpeg utilities — resolve path, parse stderr, truncate text.
 */
export function resolveFfmpegPath(ffmpegPath?: string) {
  const configured = ffmpegPath?.trim();

  if (configured) {
    return configured;
  }

  return process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
}

export function truncateText(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

/**
 * Summarize ffmpeg stderr into a user-friendly message.
 * Returns undefined when there's nothing meaningful to report.
 */
export function summarizeFfmpegStderr(stderr: string) {
  const normalized = stderr.trim();

  if (normalized.length === 0) {
    return undefined;
  }

  if (
    normalized.includes("Stream map '0:a:0' matches no streams") ||
    normalized.includes("Output file #0 does not contain any stream")
  ) {
    return "no audio track was found.";
  }

  if (
    normalized.includes("Invalid data found when processing input") ||
    normalized.includes("moov atom not found")
  ) {
    return "the file is damaged or not a supported media format.";
  }

  const meaningfulLine = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("["));

  return meaningfulLine ? truncateText(meaningfulLine) : undefined;
}

/**
 * Build an Error from an ffmpeg invocation failure.
 * @param error - the raw thrown value
 * @param prefix - error message prefix (e.g. "Failed to transform voice source")
 */
export function toFfmpegError(error: unknown, prefix: string): Error {
  const stderr =
    error instanceof Error && "stderr" in error && typeof error.stderr === "string"
      ? error.stderr
      : undefined;
  const summarized = stderr ? summarizeFfmpegStderr(stderr) : undefined;

  if (summarized) {
    return new Error(`${prefix}: ${summarized}`);
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new Error(`${prefix}: ${truncateText(error.message)}`);
  }

  return new Error(`${prefix}.`);
}
