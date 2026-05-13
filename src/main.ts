import { bootstrap } from "./app.js";
import { log } from "./core/log.js";

try {
  await bootstrap();
} catch (error) {
  log.error(
    {
      error,
    },
    "bootstrap failed",
  );
  process.exit(1);
}
