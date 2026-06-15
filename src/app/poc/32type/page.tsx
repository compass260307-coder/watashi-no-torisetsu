// ============================================================================
// 32 タイプ化 PoC 検証ページ — /poc/32type
// ============================================================================
// 隔離した実験用サーフェス。本番ページ (me/[token] 等) は一切変更せず、
// ここで「既存 scores から 32 タイプが導出され、主要コンテンツが破綻なく
// 描画される (仮表示)」ことを実証する。
//
// やっていること:
//   - サンプル scores を 32 判定 (classifyThirtyTwoType) にかける
//   - N だけ違うペアで「別タイプに分岐する」ことを示す
//   - 解決した 32 タイプから base16 へフォールバックし、本番の実コンテンツ
//     (自己診断本文 / 強み・あれっ? / 付き合い方 / 友達視点) を呼び出して描画
//
// ⚠️ PoC: N 違いは同じ base16 コンテンツを流用 (中身の差は本実装フェーズで作る)。
// ============================================================================

import Image from "next/image";
import type { BigFiveDimension } from "@/lib/types";
import {
  classifyThirtyTwoType,
  thirtyTwoType,
  nAxisOf,
  N_AXIS_LABEL,
  thirtyTwoCharacterImagePath,
  allThirtyTwoTypeIds,
  selfContentFor,
  perceivedContentFor,
  ownerManualFor,
  perceivedManualFor,
  perceivedTipsKeyFor,
  missingThirtyTwoContentKeys,
} from "@/lib/thirty-two-types";
import { classifySixteenType } from "@/lib/sixteen-types";
import { SELF_SECTION_TITLES } from "@/lib/self-result-content";

export const dynamic = "force-static";

type Scores = Record<BigFiveDimension, number>;

// 検証用サンプル: A/B は N だけ違う (同じ base16 → 32 で N 分岐するのを示す)。
const SAMPLES: { label: string; scores: Scores }[] = [
  {
    label: "A: 高O高C高E高A・N高 (繊細)",
    scores: { O: 7, C: 7, E: 7, A: 7, N: 7 },
  },
  {
    label: "B: 高O高C高E高A・N低 (鉄壁) ← A と N だけ違う",
    scores: { O: 7, C: 7, E: 7, A: 7, N: 3 },
  },
  {
    label: "C: 低O低C低E低A・N高 (繊細)",
    scores: { O: 3, C: 3, E: 3, A: 3, N: 8 },
  },
];

export default function ThirtyTwoTypePocPage() {
  const total = allThirtyTwoTypeIds().length;
  // 32実データの充足状況（フォールバックになるキーの一覧）
  const missing = missingThirtyTwoContentKeys();

  return (
    <main className="min-h-screen bg-[#E4E0F5] py-6 px-4">
      <div className="max-w-[640px] mx-auto space-y-6">
        <header className="bg-white rounded-2xl border-2 border-[#0094D8]/30 p-5">
          <p className="text-[#FE3C72] font-black text-xs tracking-widest mb-1">
            PoC / 隔離実験 (本番ページ無改変)
          </p>
          <h1 className="text-[#3A2D6B] font-black text-xl mb-2">
            32タイプ化 概念実証 — N軸で器が回るか
          </h1>
          <p className="text-[#3A2D6B]/70 text-sm leading-relaxed">
            既存 scores に N(神経症傾向) を5軸目として足し、16→{total}{" "}
            タイプを導出。①③④は32実データ（繊細/鉄壁で書き分け）を表示。万一欠ければ
            base16にフォールバック。キャラ画像と②友達視点は今回データ化対象外（base16のまま）。
          </p>
          <p className="text-[#3A2D6B]/60 text-xs font-bold mt-2">
            32実データ充足: ① {total - missing.self.length}/{total} ・ ②{" "}
            {total - missing.perceivedManual.length}/{total} ・ ③{" "}
            {total - missing.perceived.length}/{total} ・ ④{" "}
            {total - missing.manual.length}/{total}（フォールバック = self:
            {missing.self.length} / 友達視点:{missing.perceivedManual.length} /
            perceived:{missing.perceived.length} / manual:{missing.manual.length}）
          </p>
        </header>

        {SAMPLES.map((s) => {
          const base16 = classifySixteenType(s.scores);
          const id32 = classifyThirtyTwoType(s.scores);
          const meta = thirtyTwoType(id32);
          const n = nAxisOf(id32);
          // 32実データ優先 → 無ければ base16 フォールバック（resolver 経由）
          const self = selfContentFor(id32);
          const perceived = perceivedContentFor(id32);
          const manual = ownerManualFor(id32);
          const perceivedText = perceivedManualFor(id32); // ②も32実データ→base16フォールバック
          const tipsKey = perceivedTipsKeyFor(id32);

          return (
            <section
              key={s.label}
              className="bg-white rounded-2xl border-2 border-[#0094D8]/25 p-5 space-y-4"
            >
              {/* 判定サマリ */}
              <div className="border-b border-[#3A2D6B]/10 pb-3">
                <p className="text-[#3A2D6B]/60 font-bold text-xs mb-1">
                  {s.label}
                </p>
                <p className="text-[#3A2D6B]/70 text-xs mb-2">
                  scores = O{s.scores.O} C{s.scores.C} E{s.scores.E} A
                  {s.scores.A} N{s.scores.N}
                </p>
                <div className="flex items-center gap-3">
                  <Image
                    src={thirtyTwoCharacterImagePath(id32)}
                    alt={meta.name}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full bg-[#E4E0F5]"
                  />
                  <div>
                    <p className="text-[#3A2D6B] font-black text-lg leading-tight">
                      {meta.name}
                    </p>
                    <p className="text-[#3A2D6B]/60 text-xs">
                      base16: <b>{base16}</b> / 32: <b>{id32}</b>
                    </p>
                    <p className="text-[#3A2D6B]/60 text-xs">
                      code: {meta.code} ・ N軸: {N_AXIS_LABEL[n].tag}(
                      {N_AXIS_LABEL[n].nuance})
                    </p>
                  </div>
                </div>
              </div>

              {/* 自己診断本文 (base16 実コンテンツ) */}
              <div>
                <p className="text-[#0094D8] font-black text-xs mb-1">
                  ① 自己診断本文（base16実データ・仮流用）
                </p>
                {self.map((sec, i) => (
                  <div key={sec.title} className="mb-2">
                    <p className="text-[#3A2D6B] font-bold text-sm">
                      {SELF_SECTION_TITLES[i]}
                    </p>
                    <p className="text-[#3A2D6B]/70 text-xs leading-relaxed line-clamp-3">
                      {sec.body}
                    </p>
                  </div>
                ))}
              </div>

              {/* 友達視点本文 */}
              <div>
                <p className="text-[#0094D8] font-black text-xs mb-1">
                  ② 友達視点本文（32実データ）
                </p>
                <p className="text-[#3A2D6B]/70 text-xs leading-relaxed line-clamp-3">
                  {perceivedText}
                </p>
                <p className="text-[#FE3C72] text-xs font-bold mt-1">
                  tipsKey:「{tipsKey}」 ・ 本文に実在:{" "}
                  {perceivedText.split("\n\n")[1]?.includes(tipsKey)
                    ? "✓"
                    : "✗"}
                </p>
              </div>

              {/* 強み / あれっ? */}
              <div>
                <p className="text-[#0094D8] font-black text-xs mb-1">
                  ③ 強み / あれっ?（base16実データ {perceived ? "✓" : "なし"}）
                </p>
                {perceived ? (
                  <p className="text-[#3A2D6B]/70 text-xs">
                    強み {perceived.strengths.length}件 / あれっ?{" "}
                    {perceived.surprises.length}件 例:「
                    {perceived.strengths[0]?.title}」
                  </p>
                ) : (
                  <p className="text-[#FE3C72] text-xs">フォールバック未取得</p>
                )}
              </div>

              {/* 付き合い方コツ */}
              <div>
                <p className="text-[#0094D8] font-black text-xs mb-1">
                  ④ 付き合い方コツ（base16実データ {manual ? "✓" : "なし"}）
                </p>
                {manual ? (
                  <p className="text-[#3A2D6B]/70 text-xs">
                    {manual.length}件 例:「{manual[0]?.title}」
                  </p>
                ) : (
                  <p className="text-[#FE3C72] text-xs">フォールバック未取得</p>
                )}
              </div>
            </section>
          );
        })}

        <footer className="text-center text-[#3A2D6B]/50 text-xs pb-8">
          PoC 検証ページ / 本番 16 タイプ表示には影響しません
        </footer>
      </div>
    </main>
  );
}
