import { Bot, BotError } from "grammy";
import { loadEnv } from "./core/env.js";
import { log } from "./core/log.js";

export async function bootstrap() {
  const env = loadEnv();

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  bot.catch((error: BotError) => {
    log.error(
      {
        error,
      },
      "bot middleware error",
    );
  });

  await bot.start({
    onStart: async (me) => {
      log.info(
        {
          username: me.username,
        },
        "bot started",
      );
    },
  });
}
