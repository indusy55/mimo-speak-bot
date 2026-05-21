import { InlineKeyboard } from "grammy";

export function buildCancelKeyboard(sessionId: string) {
  return new InlineKeyboard().text("取消", `cancel:${sessionId}`);
}
