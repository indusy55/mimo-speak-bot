import { createTtsParamsParser } from "../src/ai/parse-tts-params.js";

async function main() {
  const parser = createTtsParamsParser({
    apiKey: process.env.OPENAI_API_KEY!,
    baseUrl: process.env.OPENAI_API_BASE_URL!,
    model: process.env.OPENAI_API_MODEL!,
    cloneVoiceNames: ["余承东", "kasumi", "孙笑川", "sxc"],
  });

  const result = await parser.parse("用余承东音色读孙笑川嘴臭");
  console.log(JSON.stringify(result, null, 2));
}

main();
