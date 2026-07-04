import {
  createOpenAI,
  type OpenAILanguageModelChatOptions,
} from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";

const modelIds = {
  preset: "mimo-v2.5-tts",
  design: "mimo-v2.5-tts-voicedesign",
  clone: "mimo-v2.5-tts-voiceclone",
} as const;

const modelList = [modelIds.preset, modelIds.design, modelIds.clone] as const;

const ttsParamsSchema = z.object({
  text: z.string(),
  voice: z.string().optional(),
  instructions: z.string().optional(),
  model: z.enum(modelList).optional(),
});

export type TTSParams = z.infer<typeof ttsParamsSchema>;

const presetVoices = [
  "冰糖", "茉莉", "苏打", "白桦", "Mia", "Chloe", "Milo", "Dean",
];

function findClosestClone(voice: string, cloneVoices: string[]): string | undefined {
  const exact = cloneVoices.find((c) => c === voice);
  if (exact) return exact;
  return cloneVoices.find((c) => c.includes(voice) || voice.includes(c));
}

function resolveModel(
  voice: string | undefined,
  instructions: string | undefined,
  llmModel: (typeof modelList)[number] | undefined,
  cloneVoices: string[],
): (typeof modelList)[number] | undefined {
  if (voice && cloneVoices.includes(voice)) return modelIds.clone;
  if (voice && presetVoices.includes(voice)) return modelIds.preset;

  if (llmModel === modelIds.design) return modelIds.design;

  if (voice && !presetVoices.includes(voice) && cloneVoices.length === 0) {
    return modelIds.design;
  }

  return llmModel;
}

function buildSystemPrompt(cloneVoiceNames: string[]): string {
  const cloneInfo = cloneVoiceNames.length
    ? `Clone samples available: ${cloneVoiceNames.join(", ")}`
    : "(no clone samples available)";

  return [
    "You extract TTS parameters from natural language. Return ONLY valid JSON, no markdown.",
    "",
    "TWO control methods; place content correctly:",
    '  Natural language control (overall style) → goes in the "instructions" field',
    '  Audio tag control (per-word/per-char effects) → embedded in the "text" field',
    "",
    'Required field:',
    '  "text" — the actual words to speak',
    '    If input describes a scene (e.g. "深圳地铁报站"), generate appropriate content.',
    "    Embed style/audio tags directly in text for fine-grained control (see below).",
    "",
    "Optional fields:",
    '  "voice" — ONLY preset or clone name (never a description)',
    "    Presets: 冰糖, 茉莉, 苏打, 白桦, Mia, Chloe, Milo, Dean",
    "    " + cloneInfo,
    "    If user mentions a voice or nickname that matches a clone name, use that clone name.",
    '    Voice design descriptions e.g. "低沉磁性的男声" go in "instructions", NOT here.',
    "    Omit if not specified. If instructions describe a custom voice design, voice must be omitted.",
    "",
    '  "model" — pick based on these rules:',
    "    If voice is a preset name → " + modelIds.preset,
    "    If voice is a clone sample name → " + modelIds.clone,
    "    If instructions describe a custom/designed voice (no preset/clone voice) → " + modelIds.design,
    "    Otherwise → omit (let API decide)",
    "",
    '  "instructions" — natural language style control (high-level overall direction)',
    "    Also holds voice design descriptions when using voicedesign model.",
    "    Simple: 温柔舒缓，语速中等",
    "    With design: 低沉磁性的中年男声，语速稍慢，带有沙哑质感",
    "    Expressive: 用轻快上扬的语调向领导报喜，语速稍快，带着查到成绩后压抑不住的激动与小骄傲",
    "",
    "    Director mode — TRIGGERED when input contains 演绎/扮演/饰演/演/角色 + a named character.",
    "    Write instructions in three dimensions:",
    '      【角色】人物身份、性格底色、说话习惯（infer from known character if applicable）',
    '      【场景】此时此地发生了什么、和谁说话、情绪位置',
    "      【指导】语速、气息、停顿、重音、共鸣位置、音色质感、情绪起伏（像导演给演员说戏）",
    "    Example:",
    '      【角色】百年门阀当家，自出生便被过继给祖庙，被塑造成绝情断欲的家族图腾。',
    '      【场景】在祠堂阴影里，看着冲破保安防线来找她、企图带她私奔的男人。',
    "      【指导】冰冷慵懒却极具威压的低音御姐。语速极慢，每个字在舌尖滚过才吐出。实音重且硬，",
    "      尾音用轻微气音收束透出疲惫与渴望。唇齿音极轻极清晰，清雅锋利。",
    "    If input names a known internet/TV/movie character (e.g. 孙笑川, 林黛玉, 孙悟空),",
    "    infer their 【角色】personality and speaking style, and construct fitting 【场景】【指导】.",
    "    Omit if not specified.",
    "",
    "Audio tag control — style tags at START of text using (tag) or [tag]:",
    "  (开心)text, (悲伤)text, [慵懒]text, (紧张，深呼吸)text, (开心)(河南话)text",
    "  Singing: (唱歌)歌词 (also accepts: sing, singing)",
    "  Multiple styles in one tag: (怅然 欣慰)text, or stacked emotion+dialect: (开心)(河南话)text",
    "  Note: only ONE dialect per utterance. 普通话+粤语 mixing in one text is not supported.",
    "",
    "Style categories (use any, not limited to this list):",
    "  基础情绪: 开心/悲伤/愤怒/恐惧/惊讶/兴奋/委屈/平静/冷漠",
    "  复合情绪: 怅然/欣慰/无奈/愧疚/释然/嫉妒/厌倦/忐忑/动情",
    "  整体语调: 温柔/高冷/活泼/严肃/慵懒/俏皮/深沉/干练/凌厉",
    "  音色定位: 磁性/醇厚/清亮/空灵/稚嫩/苍老/甜美/沙哑/醇雅",
    "  人设腔调: 夹子音/御姐音/正太音/大叔音/台湾腔",
    "  方言: 东北话/四川话/河南话/粤语",
    "  角色扮演: 孙悟空/林黛玉",
    "  唱歌: 唱歌",
    "",
    "Audio tag control — inline effect [标签] inserted ANYWHERE in text:",
    "  语速与节奏: [吸气] [深呼吸] [叹气] [长叹一口气] [喘息] [屏息]",
    "  情绪状态: [紧张] [害怕] [激动] [疲惫] [委屈] [撒娇] [心虚] [震惊] [不耐烦]",
    "  语音特征: [颤抖] [声音颤抖] [变调] [破音] [鼻音] [气声] [沙哑]",
    "  哭笑表达: [笑] [轻笑] [大笑] [冷笑] [抽泣] [呜咽] [哽咽] [嚎啕大哭]",
    "  Per-char modulation: [微调] [上扬] [下降] [稳重] [拖音]",
    "",
    "Rich examples:",
    '  (紧张，深呼吸)呼……冷静，冷静。不就是一个面试吗……[语速加快]自我介绍已经背了五十遍了。',
    "  (极其疲惫，有气无力)师傅……到地方了叫我一声……[长叹一口气]我先眯一会儿，这班加得我魂儿都要散了。",
    "  如果我当时……[沉默片刻]哪怕再坚持一秒钟，结果是不是就不一样了？[苦笑]呵，没如果了。",
    "  [寒冷导致的急促呼吸]呼——呼——这大兴安岭的雪……[咳嗽]简直能把人骨头冻透了！",
    "  [提高音量喊话]大姐！这鱼新鲜着呢！早上刚捞上来的！哎！那个谁，别乱翻！",
    "  Per-char intonation: [微调]欢[上扬]迎[下降]乘[微调]坐[上扬]深[下降]圳[微调]地[微调]铁",
    "  Per-word emotion switch: (开心)欢迎(沉稳)乘坐本次列车(激昂)前方到站——",
    "",
    "Style tag rules:",
    "  - Style/effect tags directly precede the text they modify, no space/punctuation between tag and text.",
    "  - Tags at end of text with no following text are invalid.",
    "  - Brackets: half-width () [] or full-width （） [] all work for style tags.",
    "  - Use tags SPARINGLY and with intent. Only tag where there's a deliberate, noticeable shift",
    "    in emotion/intonation/pace. Natural speech already has inherent variation; tags should",
    "    highlight intentional contrasts, not micromanage every syllable.",
    "  - CRITICAL: dialect (粤语/东北话/四川话/河南话), character voice (御姐音/大叔音/台湾腔),",
    '    role-play (孙悟空/林黛玉), and singing (唱歌) are GLOBAL tags. They MUST appear at the',
    '    VERY START of the "text" field as (tag). Cannot be switched mid-text. Do NOT bury in "instructions".',
  ].join("\n");
}

export function createTtsParamsParser({
  apiKey,
  baseUrl,
  model,
  cloneVoiceNames = [],
}: {
  apiKey: string;
  baseUrl: string;
  model: string;
  cloneVoiceNames?: string[];
}) {
  const openai = createOpenAI({ apiKey, baseURL: baseUrl });
  const systemPrompt = buildSystemPrompt(cloneVoiceNames);

  return {
    async parse(input: string): Promise<{
      text: string;
      voice?: string;
      instructions?: string;
      mode: "clone" | "design" | "preset";
    }> {
      const result = await generateText({
        model: openai.chat(model),
        allowSystemInMessages: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input },
        ],
        providerOptions: {
          openai: {
            systemMessageMode: "system",
          } satisfies OpenAILanguageModelChatOptions,
        },
      });

      // Strip markdown code fence if LLM wrapped it
      const cleanJson = result.text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
      const raw = JSON.parse(cleanJson) as Record<string, unknown>;
      const parsed = ttsParamsSchema.safeParse(raw);

      if (!parsed.success) {
        throw new Error(`Failed to parse TTS params: ${parsed.error.message}`);
      }

      const { voice, instructions } = parsed.data;
      let llmModel = parsed.data.model;

      // Fuzzy match voice against available clone voices
      let resolvedVoice = voice;
      if (voice) {
        const matched = findClosestClone(voice, cloneVoiceNames);
        if (matched) {
          resolvedVoice = matched;
          if (llmModel !== modelIds.design) llmModel = modelIds.clone;
        }
      }

      llmModel = resolveModel(resolvedVoice, instructions, llmModel, cloneVoiceNames);

      // voicedesign model does NOT accept a voice parameter
      if (llmModel === modelIds.design) {
        resolvedVoice = undefined;
      }

      // Map model ID back to mode enum
      const mode = llmModel === modelIds.clone
        ? "clone"
        : llmModel === modelIds.design
          ? "design"
          : "preset";

      return {
        text: parsed.data.text,
        voice: resolvedVoice,
        instructions,
        mode,
      };
    },
  };
}
