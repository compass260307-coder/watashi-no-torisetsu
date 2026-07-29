// 運命の設計図 (/unmei) の鑑定表示。生JSONを購入者向けに整形する presentational コンポーネント。
//
// 配色 (紺・黄・白): 紺の色面が出るのは出生図ホイールの領域のみ。それ以外は白地に紺文字。
//   - 章見出し = 丸数字バッジ + h2 (text-[30px]/[36px] font-black text-[#2E2E5C] = 紺)
//   - 本文     = body-gothic text-[17px] leading-[1.4]、\n\n を段落区切りに (既存の文字色)
//   - 章ごとの淡い色面 (空/陸/海/未知) は廃止。本文エリアは白地、章間は余白で区切る。
// 新しいUIパーツ (カード/罫線/枠線/ボタン風の装飾) は追加しない。
//
// 入力JSONの正 (src/lib/unmei/prompts.mjs のスキーマ):
//   { hitokoto: string, sections: [{ id, title, body }] } (sections は haichi/kokoro/chosen/grace の4本)
// ※ subline に相当するフィールドはデータに存在しないため表示しない (縦位置だけ将来用に確保)。

import NatalChartWheel from "@/components/uranai/NatalChartWheel";
import UnmeiViewTracker from "@/components/uranai/UnmeiViewTracker";
import type { Chart, MoonArc } from "@/lib/unmei/chart-view";

// 表示タイトルの上書き (id→表示名)。プロンプト側の title も同文言だが、既存 readings にも
// 即時反映させるため表示はこのマップを優先する (id 不変・再生成不要)。
const UNMEI_TITLE: Record<string, string> = {
  haichi: "あなたが積み上げてきたもの",
  kokoro: "誰かといるときのあなた",
  chosen: "これから訪れる転換点",
  grace: "最後にひとつだけ",
};

type UnmeiSection = { id?: string; title?: string; subline?: string; body?: string };
type UnmeiReadingData = { hitokoto?: string; sections?: UnmeiSection[] };

export default function UnmeiReading({
  reading,
  chart = null,
  timeUnknown = false,
  moonArc = null,
  essence = null,
  trackView = true,
}: {
  reading: unknown;
  chart?: Chart | null;
  timeUnknown?: boolean;
  moonArc?: MoonArc | null;
  essence?: string | null;
  trackView?: boolean;
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
      {trackView ? (
        <UnmeiViewTracker eventName="unmei_reading_view" state="ready" />
      ) : null}
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
      <NatalChartWheel
        chart={chart}
        timeUnknown={timeUnknown}
        moonArc={moonArc}
        essence={essence}
      />

      {/* 4章それぞれを章として表示。色面は廃止し白地。章間は余白のみで区切る。 */}
      {sections.map((sec, i) => {
        const paragraphs = (sec.body ?? "")
          .split("\n\n")
          .map((p) => p.trim())
          .filter(Boolean);
        return (
          <section
            key={sec.id ?? i}
            aria-label={sec.title ?? undefined}
            className="mt-14 first:mt-12"
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
                  {UNMEI_TITLE[sec.id ?? ""] ?? sec.title}
                </h2>
              </div>

              {/* subline: 見出し直下の1行 (スコア%×星の要素)。無料診断の note と同スタイル。
                  空 (grace) や未提供 (旧 reading) のときは非表示。 */}
              {typeof sec.subline === "string" && sec.subline.trim() && (
                <p className="mt-3 text-sm text-[#2E2E5C]/70">
                  {sec.subline.trim()}
                </p>
              )}
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
