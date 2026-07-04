import { replyText } from "../reply.js";
import type { CommandDeps } from "./types.js";

export const commands = [
  { command: "start", description: "查看用法" },
  { command: "sp", description: "预置音色朗读" },
  { command: "sc", description: "声音源朗读" },
  { command: "sd", description: "设计音色朗读" },
  { command: "vp", description: "查看预置音色" },
  { command: "vs", description: "查看声音源" },
  { command: "va", description: "添加声音源" },
  { command: "vd", description: "删除声音源" },
  { command: "sg", description: "智能语音合成" },
];

const startText = [
  "TTS AI BOT",
  "",
  "/sp 音色 [-s 风格] [-i 提示词] 文本",
  "/sc 音色 [-s 风格] [-i 提示词] 文本",
  "/sd 音色设计描述 [-s 风格] [-i 提示词] 文本",
  "",
  "或带着命令和参数恢复到文本上，也支持 quote",
].join("\n");

export function registerBasicCommands({
  bot,
}: Pick<CommandDeps, "bot">) {
  bot.command("start", (ctx) => replyText(ctx, startText));
}
