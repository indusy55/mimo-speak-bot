import { loadEnv } from "../src/core/env.js";
import { createDb } from "../src/db/client.js";
import { createVoiceFileStore } from "../src/voice/file-store.js";
import { createVoiceSourceRepository } from "../src/voice/repository.js";
import { migrateLegacyVoiceSources } from "../src/voice/migrate-legacy.js";

const env = loadEnv();
const db = createDb(env);
const repository = createVoiceSourceRepository({ db });
const fileStore = createVoiceFileStore({ dir: env.TTS_VOICE_SOURCES_DIR });
const migrated = await migrateLegacyVoiceSources({
  dir: env.TTS_VOICE_SOURCES_DIR,
  fileStore,
  repository,
});
console.log(`Migrated ${migrated} voice sources`);
