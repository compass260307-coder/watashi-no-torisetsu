import assert from "node:assert/strict";
import { unmeiRepairInternals } from "../src/lib/unmei/generateWorker.mjs";

const reading = {
  locale: "ja",
  hitokoto: "積み上げた判断軸が、次の一歩を支えます。",
  sections: [
    {
      id: "haichi",
      title: "あなたが積み上げてきたもの",
      subline: "開放性75 × 太陽 ↔ 水星",
      body: "新しい選択肢を見つけ、具体的な行動へ移す人です。",
    },
    {
      id: "kokoro",
      title: "誰かといるときのあなた",
      subline: "協調性64 × 月 ↔ 金星",
      body: "相手の考えを尊重しながら、自分の基準も守るでしょう。",
    },
    {
      id: "chosen",
      title: "これから訪れる転換点",
      subline: "開放性75 × 木星 ↔ 土星",
      body: "準備してきたことを日程へ落とし込み、実行へ移します。",
    },
    {
      id: "grace",
      title: "最後にひとつだけ",
      subline: "",
      body: "積み上げた時間は、すでに次の選択を支えています。",
    },
  ],
};

const targets = unmeiRepairInternals.expressionRepairTargets(reading, "ja");
assert.equal(targets.hitokoto, null);
assert.deepEqual(
  targets.sections.map(({ id, fields }) => ({ id, fields: Object.keys(fields) })),
  [{ id: "kokoro", fields: ["body"] }],
);
assert.ok(unmeiRepairInternals.expressionRepairMaxTokens(targets) < 4500);

const prompt = unmeiRepairInternals.buildExpressionRepairPrompt(
  reading,
  targets,
  "ja",
);
assert.match(prompt, /kokoro/);
assert.doesNotMatch(prompt, /haichi/);
assert.doesNotMatch(prompt, /chosen/);

const corrected = unmeiRepairInternals.mergeExpressionRepair(
  reading,
  targets,
  {
    sections: [
      {
        id: "kokoro",
        body: "相手の考えを尊重しながら、自分の基準も守ります。",
      },
    ],
  },
);
assert.equal(
  corrected.sections[1].body,
  "相手の考えを尊重しながら、自分の基準も守ります。",
);
assert.deepEqual(corrected.sections[0], reading.sections[0]);
assert.equal(
  unmeiRepairInternals.hasExpressionRepairTargets(
    unmeiRepairInternals.expressionRepairTargets(corrected, "ja"),
  ),
  false,
);

const englishReading = structuredClone(reading);
englishReading.locale = "en";
englishReading.hitokoto = "You turn careful thought into concrete action.";
englishReading.sections = englishReading.sections.map((section, index) => ({
  ...section,
  title: [
    "What you have built",
    "Who you are with others",
    "The turning point ahead",
    "One last thing",
  ][index],
  subline: index === 3 ? "" : "Openness 75 × Sun ↔ Mercury",
  body: "You notice new options and turn them into concrete action.",
}));
englishReading.sections[2].body += " かもしれません";
const englishTargets = unmeiRepairInternals.expressionRepairTargets(
  englishReading,
  "en",
);
assert.deepEqual(
  englishTargets.sections.map(({ id, fields }) => ({
    id,
    fields: Object.keys(fields),
  })),
  [{ id: "chosen", fields: ["body"] }],
);
assert.deepEqual(
  unmeiRepairInternals.structuralReadingErrors(englishReading, "en"),
  [],
  "foreign-script violations are repairable expression issues, not a full-regeneration trigger",
);

const structurallyBroken = structuredClone(reading);
structurallyBroken.sections.pop();
assert.ok(
  unmeiRepairInternals.structuralReadingErrors(structurallyBroken, "ja").length >
    0,
  "a broken required JSON structure remains a full-regeneration trigger",
);

console.log("unmei expression repair test: PASS");
