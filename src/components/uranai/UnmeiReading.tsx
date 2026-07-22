// 運命の設計図 (/unmei) の鑑定表示。生JSONを購入者向けに整形する presentational コンポーネント。
//
// 視覚言語は無料診断の結果ページ (MeResultPage / DeepDiveSections) に完全準拠する:
//   - 章見出し = 丸数字バッジ + h2 (text-[30px]/[36px] font-black text-[#2E2E5C])
//   - 本文     = body-gothic text-[17px] leading-[1.4]、\n\n を段落区切りに
//   - 章と章の間は淡い色面 (hero-colors の softBg: 海/空/陸/未知) で区切る
// 新しいUIパーツ (カード/罫線/枠線/ボタン風の装飾) は追加しない。色面と本文だけで構成する。
//
// 入力JSONの正 (src/lib/unmei/prompts.mjs のスキーマ):
//   { hitokoto: string, sections: [{ id, title, body }] } (sections は haichi/kokoro/chosen/grace の4本)
// ※ subline に相当するフィールドはデータに存在しないため表示しない (縦位置だけ将来用に確保)。

import NatalChartWheel from "@/components/uranai/NatalChartWheel";
import type { Chart, MoonArc } from "@/lib/unmei/chart-view";

// 章ごとの淡い色面。hero-colors.ts の CARD_TONE[group].softBg を流用 (海/空/陸/未知の順)。
const SECTION_TINTS = [
  "#EAF7FA", // 海: 淡いシアン
  "#FBF6E4", // 空: 淡いイエロー
  "#EEF7E9", // 陸: 淡いグリーン
  "#F3EFFB", // 未知: 淡いラベンダー
];

type UnmeiSection = { id?: string; title?: string; body?: string };
type UnmeiReadingData = { hitokoto?: string; sections?: UnmeiSection[] };

export default function UnmeiReading({
  reading,
  chart = null,
  timeUnknown = false,
  moonArc = null,
}: {
  reading: unknown;
  chart?: Chart | null;
  timeUnknown?: boolean;
  moonArc?: MoonArc | null;
}) {
  const data = (reading ?? {}) as UnmeiReadingData;
  const hitokoto = typeof data.hitokoto === "string" ? data.hitokoto.trim() : "";
  const sections: UnmeiSection[] = Array.isArray(data.sections)
    ? data.sections.filter(
        (s): s is UnmeiSection => !!s && typeof s === "object",
      )
    : [];

  return (
    <main className="bg-white pb-16">
      {/* 冒頭: タイトル + ひとこと (hitokoto は本文より一回り大きい導入。章見出しではない扱い) */}
      <div className="mx-auto max-w-[640px] px-6 pt-12">
        <h1 className="mb-6 text-2xl font-black text-[#2E2E5C]">
          あなたの運命の設計図
        </h1>
        {hitokoto && (
          <p className="text-[20px] font-bold leading-[1.6] text-[#2E2E5C] md:text-[22px]">
            {hitokoto}
          </p>
        )}
      </div>

      {/* 出生図ホイール: hitokoto 直後・章1の前。「自分の生年月日と時刻から作られた図」と
          一目で伝える。chart が無ければ非表示 (フェイルクローズ)。 */}
      <NatalChartWheel chart={chart} timeUnknown={timeUnknown} moonArc={moonArc} />

      {/* 4章それぞれを章として表示。章と章の間は淡い色面で区切る (mt-10 の白余白 + 色帯)。 */}
      {sections.map((sec, i) => {
        const tint = SECTION_TINTS[i % SECTION_TINTS.length];
        const paragraphs = (sec.body ?? "")
          .split("\n\n")
          .map((p) => p.trim())
          .filter(Boolean);
        return (
          <section
            key={sec.id ?? i}
            aria-label={sec.title ?? undefined}
            className="mt-10 py-12"
            style={{ backgroundColor: tint }}
          >
            <div className="mx-auto max-w-[640px] px-6">
              {/* 章見出し: 丸数字 + タイトル (MeResultPage / DeepDiveSections と同一) */}
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                >
                  {i + 1}
                </span>
                <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                  {sec.title}
                </h2>
              </div>

              {/* subline スロット (データ未提供のため現状は表示なし。将来ここに1行入る)。 */}
              {/* 章の挿絵スロット: 画像は別途制作。差し込めるよう見出しと本文の間に余白を確保する。 */}
              <div className="mt-6">
                {paragraphs.map((para, pi) => (
                  <p
                    key={pi}
                    className="body-gothic mb-4 text-[17px] font-normal leading-[1.4] text-[#1A1A1A] last:mb-0"
                  >
                    {para}
                  </p>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
