import { replyText } from "../reply.js";
import type { CommandDeps } from "./types.js";

export const commands = [
  { command: "start", description: "查看用法" },
  { command: "sp", description: "预置音色朗读" },
  { command: "sc", description: "声音源朗读" },
  { command: "sd", description: "设计音色朗读" },
  { command: "ss", description: "选择音色朗读" },
  { command: "vp", description: "查看预置音色" },
  { command: "vs", description: "查看声音源" },
  { command: "va", description: "添加声音源" },
  { command: "vd", description: "删除声音源" },
];

const startText = [
  "语音机器人",
  "",
  "/sp (冰糖) 文本",
  "/sc (马保国) 文本",
  "/sd (温柔的女声) 文本",
  "/ss 回复一条消息后选择音色",
  "",
  "也可以回复消息后只发命令参数。",
].join("\n");

export function registerBasicCommands({
  bot,
}: Pick<CommandDeps, "bot">) {
  bot.command("start", (ctx) => replyText(ctx, startText));
}
