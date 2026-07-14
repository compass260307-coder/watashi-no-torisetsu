import { allThirtyTwoTypeIds, thirtyTwoName } from "../src/lib/thirty-two-types";
import { detailedReportFor, missingDetailedReportKeys, REPORT_CHAPTER_TITLES } from "../src/lib/detailed-report-content";

const ids = allThirtyTwoTypeIds();
const missing = missingDetailedReportKeys(ids);
console.log(`== 登録: ${ids.length - missing.length}/${ids.length}`, missing.length ? `欠落: ${missing.join(",")}` : "");

const PLACEHOLDER = /TODO|FIXME|ダミー|プレースホルダ|後で書く|仮文|\(仮\)|（仮）|XXX|lorem/i;
const TRADEMARK = /MBTI|16Personalities|Myers|ユング|INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP/;
const TEMPLATE_TOKEN = /\{[A-Z]\}|\$\{/;

type SecText = { id: string; ch: string; text: string };
const allSecs: SecText[] = [];
let problems = 0;

console.log("\nタイプ | 総文字数 | 章別文字数 (8章)");
for (const id of ids) {
  const r = detailedReportFor(id);
  if (!r) continue;
  const titles = r.chapters.map((c) => c.title);
  if (JSON.stringify(titles) !== JSON.stringify([...REPORT_CHAPTER_TITLES])) {
    problems++; console.log(`✗ ${id}: 章タイトル不一致 [${titles.join("/")}]`);
  }
  const perCh: number[] = [];
  for (const ch of r.chapters) {
    let n = 0;
    if (!ch.sections.length) { problems++; console.log(`✗ ${id}: 「${ch.title}」が空`); }
    for (const s of ch.sections) {
      const text = [s.heading, s.quote, s.body, ...(s.bullets ?? []).flatMap(b => [b.title, b.body])].filter(Boolean).join("\n");
      n += text.length;
      allSecs.push({ id, ch: ch.title, text });
      for (const [name, re] of [["placeholder", PLACEHOLDER], ["商標/16タイプ略語", TRADEMARK], ["テンプレ変数", TEMPLATE_TOKEN]] as const) {
        const m = text.match(re);
        if (m) { problems++; console.log(`✗ ${id} 「${ch.title}」: ${name} 検出 → "${m[0]}"`); }
      }
    }
    perCh.push(n);
  }
  const total = perCh.reduce((a, b) => a + b, 0);
  const thin = perCh.map((n, i) => n < 250 ? `${REPORT_CHAPTER_TITLES[i]}=${n}字` : null).filter(Boolean);
  if (thin.length) { problems++; console.log(`✗ ${id}: 薄い章 ${thin.join(", ")}`); }
  console.log(`${thirtyTwoName(id).padEnd(10, "　")} ${id.padEnd(20)} ${String(total).padStart(5)}字 | ${perCh.join(", ")}`);
}

// タイプ間の本文重複 (完全一致セクション)
const byText = new Map<string, SecText[]>();
for (const s of allSecs) {
  if (s.text.length < 60) continue;
  const arr = byText.get(s.text) ?? [];
  arr.push(s); byText.set(s.text, arr);
}
let dup = 0;
for (const [text, arr] of byText) {
  const uniqIds = new Set(arr.map(a => a.id));
  if (uniqIds.size > 1) { dup++; problems++; console.log(`✗ 重複本文 (${[...uniqIds].join(", ")}) 「${arr[0].ch}」: ${text.slice(0, 40)}…`); }
}
console.log(`\n重複セクション: ${dup}件`);
console.log(problems === 0 ? "\n✅ 全32タイプ問題なし" : `\n⚠️ 問題 ${problems}件`);
