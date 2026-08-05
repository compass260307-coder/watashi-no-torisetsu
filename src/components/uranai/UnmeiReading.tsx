// 運命の設計図 (/unmei) の鑑定表示。生JSONを購入者向けに整形する presentational コンポーネント。
//
// 2026-08-05: ページ全体を「夜空の旅」形式に刷新 (出生図ステージの方向性を全体へ拡張)。
//   - 地色は紺 (#17172E)。StarBackdrop (fixed) が全篇の星空を敷き、スクロールで
//     コンテンツだけが流れる = それ自体が奥行きのパララックスになる。
//   - 構成: 表紙 (タイトル+hitokoto を1画面中央) → 出生図ステージ (スクロール演出)
//     → 4章 (Reveal で段落が浮かび上がる) → 結びの一言。
//   - 文字は白。アクセントは金 (#F5D66B) のみ (紺・黄・白の3色を維持)。
//   - 章見出し = 金の丸数字バッジ + h2 白。本文 = body-gothic 白/85・ゆったり行間
//     (暗地の長文は白地より行間を広く取る)。
//
// 入力JSONの正 (src/lib/unmei/prompts.mjs のスキーマ):
//   { hitokoto: string, sections: [{ id, title, body }] } (sections は haichi/kokoro/chosen/grace の4本)
// ※ subline に相当するフィールドはデータに存在しないため表示しない (縦位置だけ将来用に確保)。

import NatalChartStage from "@/components/uranai/NatalChartStage";
import { Reveal } from "@/components/uranai/Reveal";
import { StarBackdrop } from "@/components/uranai/StarBackdrop";
import { TypeConstellation } from "@/components/uranai/TypeConstellation";
import UnmeiViewTracker from "@/components/uranai/UnmeiViewTracker";
import type { Chart, MoonArc } from "@/lib/unmei/chart-view";
import type { UnmeiIdentity } from "@/lib/unmei/prompt-inputs";

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
  characterSlug = null,
  identity = null,
  trackView = true,
}: {
  reading: unknown;
  chart?: Chart | null;
  timeUnknown?: boolean;
  moonArc?: MoonArc | null;
  essence?: string | null;
  characterSlug?: string | null; // 表紙のキャラクター星座アート選択 (例: "dolphin")
  identity?: UnmeiIdentity | null; // 表紙カードのキャラ名・キャッチ・グループ
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
    <main className="relative bg-[#17172E] pb-32 text-white">
      {trackView ? (
        <UnmeiViewTracker eventName="unmei_reading_view" state="ready" />
      ) : null}

      {/* 全篇の星空 (fixed)。後続のコンテンツは relative で星の上に描く */}
      <StarBackdrop />

      <div className="relative">
        {/* ===== 開幕: 出生図ステージ (2026-08-06 指示でページ先頭へ)。
            寝ていた出生図が起き上がる旅からページが始まる。chart 無しなら非表示 ===== */}
        <NatalChartStage
          chart={chart}
          timeUnknown={timeUnknown}
          moonArc={moonArc}
          essence={essence}
        />

        {/* ===== 章への橋渡し: 星のアイデンティティカード (2026-08-06 全面刷新) =====
            出生図 (=事実) から鑑定本文 (=物語) へ渡す踊り場。ここで「あなたは誰か」を
            はっきり告げる: キャラクターの星座を額装したカードに、称号 (金の主役) と
            タイプ名・グループ、そして一行キャッチ (明確なメッセージ) を重ねる。
            hitokoto (鑑定本文の導入) はカード下に静かに置く。 */}
        <section className="relative flex min-h-[92svh] flex-col items-center justify-center px-6 py-16 text-center">
          <Reveal>
            <h1 className="text-[12px] font-black tracking-[0.34em] text-[#F5D66B]">
              あなたの運命の設計図
            </h1>
          </Reveal>

          <Reveal delay={200}>
            {/* 星のアイデンティティカード: 金の細枠 + 四隅の✦ + ガラス地 */}
            <div className="relative mt-7 w-[320px] max-w-full rounded-[26px] border border-[#F5D66B]/25 bg-white/[0.05] px-6 pb-8 pt-7 shadow-[0_10px_50px_rgba(0,0,0,0.35)] md:w-[380px]">
              {/* 四隅の小さな✦ (額装のあしらい) */}
              {[
                "left-3 top-3",
                "right-3 top-3",
                "left-3 bottom-3",
                "right-3 bottom-3",
              ].map((pos) => (
                <span
                  key={pos}
                  aria-hidden="true"
                  className={`absolute ${pos} text-[10px] leading-none text-[#F5D66B]/50`}
                >
                  ✦
                </span>
              ))}

              {/* キャラクターの星座 (額の中の主役の絵) */}
              <TypeConstellation essence={essence} characterSlug={characterSlug} />

              {/* ✦ 区切り線 */}
              <div className="mx-auto mt-2 flex items-center justify-center gap-2.5">
                <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#F5D66B]/50" />
                <span aria-hidden="true" className="text-[10px] text-[#F5D66B]">
                  ✦
                </span>
                <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#F5D66B]/50" />
              </div>

              {/* 称号 = 金の主役 (＝この鑑定が告げる「あなた」) */}
              {essence ? (
                <>
                  <p className="mt-4 text-[12px] font-bold tracking-[0.2em] text-white/55">
                    あなたは
                  </p>
                  <h2 className="mt-1.5 bg-gradient-to-b from-[#F9EBB0] via-[#EDD174] to-[#C9A63E] bg-clip-text text-[34px] font-black tracking-[0.14em] text-transparent md:text-[40px]">
                    {essence}
                  </h2>
                  {identity && (
                    <p className="mt-2 flex items-center justify-center gap-2 text-[12.5px] font-bold text-white/70">
                      <span>{identity.typeName}</span>
                      <span
                        aria-hidden="true"
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: identity.groupColor }}
                      />
                      <span>{identity.groupLabel}のタイプ</span>
                    </p>
                  )}
                </>
              ) : (
                <h2 className="mt-4 text-[22px] font-black tracking-[0.14em] text-[#F5D66B]">
                  あなたの星座
                </h2>
              )}
            </div>
          </Reveal>

          {/* 一行キャッチ = 明確なメッセージ (32タイプ固有のモットー) */}
          {identity?.catchphrase && (
            <Reveal delay={380}>
              <p className="mx-auto mt-9 max-w-[540px] text-[19px] font-black leading-[1.9] text-white md:text-[22px]">
                「{identity.catchphrase}」
              </p>
            </Reveal>
          )}

          {/* hitokoto = 鑑定本文の詩的な導入 (カードより控えめに) */}
          {hitokoto && (
            <Reveal delay={520}>
              <p className="mx-auto mt-6 max-w-[540px] text-[15px] font-bold leading-[2] text-white/70 md:text-[16px]">
                {hitokoto}
              </p>
            </Reveal>
          )}
        </section>

        {/* ===== 4章: スクロールに合わせて段落が浮かび上がる ===== */}
        {sections.map((sec, i) => {
          const paragraphs = (sec.body ?? "")
            .split("\n\n")
            .map((p) => p.trim())
            .filter(Boolean);
          return (
            <section
              key={sec.id ?? i}
              aria-label={sec.title ?? undefined}
              className="mt-24 md:mt-32"
            >
              <div className="mx-auto max-w-[640px] px-6">
                <Reveal>
                  {/* 章見出し: 金の丸数字 + 白タイトル (夜空の中の道しるべ) */}
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#F5D66B] text-lg font-black text-[#F5D66B]"
                    >
                      {i + 1}
                    </span>
                    <h2 className="text-[26px] font-black leading-tight text-white md:text-[32px]">
                      {UNMEI_TITLE[sec.id ?? ""] ?? sec.title}
                    </h2>
                  </div>

                  {/* subline: 見出し直下の1行 (スコア%×星の要素)。旧 reading では未提供のため非表示。 */}
                  {typeof sec.subline === "string" && sec.subline.trim() && (
                    <p className="mt-3 text-sm text-white/60">
                      {sec.subline.trim()}
                    </p>
                  )}
                </Reveal>

                {/* 章の挿絵スロット: 画像は別途制作。差し込めるよう見出しと本文の間に余白を確保する。 */}
                <div className="mt-7">
                  {paragraphs.map((para, pi) => (
                    <Reveal key={pi}>
                      <p className="body-gothic mb-5 text-[16px] font-normal leading-[1.9] text-white/85 last:mb-0 md:text-[17px]">
                        {para}
                      </p>
                    </Reveal>
                  ))}
                </div>
              </div>
            </section>
          );
        })}

        {/* ===== 結び: 旅の終わりの一言 ===== */}
        <section className="mt-28 px-6 text-center md:mt-36">
          <Reveal>
            <span aria-hidden="true" className="text-[20px] text-[#F5D66B]">
              ✦
            </span>
            <p className="mx-auto mt-6 max-w-[560px] text-[18px] font-bold leading-[2] md:text-[20px]">
              星は、答えではなく道しるべ。
              <br />
              迷ったときは、いつでもこの空に戻ってきてください。
            </p>
          </Reveal>
        </section>
      </div>
    </main>
  );
}
