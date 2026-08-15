import assert from "node:assert/strict";
import {
  buildNatalSystemPrompt,
  buildNatalUserPrompt,
  buildUnmeiPlan,
} from "../src/lib/unmei/prompts.mjs";
import {
  isReadingLocaleValid,
  validateReadingLocale,
} from "../src/lib/unmei/reading-validation.mjs";

const JAPANESE_OR_HAN_SCRIPT = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;

const chart = {
  source: "test-fixture",
  location: { latitude: 37.5665, longitude: 126.978 },
  planets: {
    sun: { sign: "Taurus", degree: 5.8 },
    moon: { sign: "Cancer", degree: 12.4 },
    mercury: { sign: "Aries", degree: 28.1 },
    venus: { sign: "Gemini", degree: 3.2 },
    mars: { sign: "Gemini", degree: 7.6 },
    jupiter: { sign: "Virgo", degree: 9.3 },
    saturn: { sign: "Cancer", degree: 8.5 },
    uranus: { sign: "Pisces", degree: 6.1 },
    neptune: { sign: "Aquarius", degree: 15.2 },
    pluto: { sign: "Sagittarius", degree: 21.7 },
  },
  asc: { sign: "Aquarius", degree: 18.4 },
  mc: { sign: "Sagittarius", degree: 4.9 },
};
const scores = { O: 7.5, C: 4.3, E: 3.8, A: 6.4, N: 5.9 };
const nowIso = "2026-08-14T00:00:00+09:00";

const koSystem = buildNatalSystemPrompt("ko");
const koUser = buildNatalUserPrompt({
  chart,
  scores,
  essence: "전략가",
  typeName: "쿨한 매",
  timeUnknown: false,
  nowIso,
  locale: "ko",
});
const jaSystem = buildNatalSystemPrompt("ja");
const jaUser = buildNatalUserPrompt({
  chart,
  scores,
  essence: "戦略家",
  typeName: "クールな鷹",
  timeUnknown: false,
  nowIso,
  locale: "ja",
});

assert.equal(JAPANESE_OR_HAN_SCRIPT.test(koSystem), false, "Korean system prompt must not contain Japanese or Han script");
assert.equal(JAPANESE_OR_HAN_SCRIPT.test(koUser), false, "Korean user prompt must not contain Japanese or Han script");
assert.match(koSystem, /당신이 차곡차곡 쌓아 온 것/);
assert.match(koUser, /개방성75/);
assert.match(koUser, /태양: 황소자리5\.8°/);
assert.match(koUser, /현재 흐름: 목성=/);
assert.match(koUser, /32가지 유형: 쿨한 매 \/ 별칭: 전략가/);
assert.match(jaSystem, /あなたが積み上げてきたもの/);
assert.match(jaUser, /太陽: 牡牛座5\.8°/);

const koPlan = buildUnmeiPlan(scores, "ko");
assert.match(koPlan.haichiSubject, /개방성75/);
assert.equal(JAPANESE_OR_HAN_SCRIPT.test(koPlan.haichiSubject), false);

const validKoreanReading = {
  locale: "ko",
  hitokoto: "당신의 강점은 분명한 기준과 따뜻한 시선을 함께 쓰는 데 있어요.",
  sections: [
    {
      id: "haichi",
      title: "당신이 차곡차곡 쌓아 온 것",
      subline: "개방성75 × 태양 ↔ 수성",
      body: "당신은 새로운 가능성을 실제 선택으로 옮기는 사람입니다.",
    },
    {
      id: "kokoro",
      title: "누군가와 함께 있을 때의 당신",
      subline: "우호성64 × 달 ↔ 금성",
      body: "관계에서는 다정함과 분명한 거리를 함께 지킵니다.",
    },
    {
      id: "chosen",
      title: "앞으로 찾아올 전환점",
      subline: "개방성75 × 목성 ↔ 토성",
      body: "준비해 온 일을 구체적인 일정으로 옮길 시기가 다가옵니다.",
    },
    {
      id: "grace",
      title: "마지막으로 한 가지만",
      subline: "",
      body: "당신이 쌓아 온 시간은 이미 다음 선택을 받쳐 주고 있어요.",
    },
  ],
};

assert.equal(isReadingLocaleValid(validKoreanReading, "ko"), true);
const contaminatedReading = structuredClone(validKoreanReading);
contaminatedReading.sections[0].body += " 太陽は牡牛座です。";
assert.equal(isReadingLocaleValid(contaminatedReading, "ko"), false);
assert.match(validateReadingLocale(contaminatedReading, "ko").join("\n"), /Japanese or Han script/);

console.log("unmei prompt locale test: PASS");
