"use client";

// 三層ゲートの「奥(報酬)レイヤー」= 解放後 /tako 結果ページの“本物の器”を写した軽量ダミー。
//   ★生レンダリングはしない (ResultHero 等の実体はマウントしない)。実結果ページの
//     セクション構成・順序・余白・見出し位置・カード形を“完全に”ミラーしたスケルトン。
//   実結果ページ(完成トリセツ) = ヒーロー帯 + 全セクション:
//     ① みんなの目 ② ギャップ ③ 強み ④ 取扱注意 ⑤ 恋愛 ⑥ キャリア ⑦ 友達の回答 ⑧ 相性。
//   ★スクロールしても「まだ下に自分の結果が続いている」感覚を作るため、実結果の全長を敷く。
//   ★診断結果で変わる部分 (キャラ名・本文・スコア・型依存) は ? / バーで伏せる (ネタバレ無し)。
//   ★変わらない部分 (レイアウト・見出し位置・構造・カード形) だけ本物に寄せる。
//   ★見出しは「問い」形式を維持 (奥の中だけ)。手前・実結果ページの見出しは不変。
//
// 段階リビール: answered が増えるたびに openN 個のセクションから ? が外れ本文blurが緩む。
// 色は白基調・無彩 (紫みは撤去)。番号バッジ/見出しは既存ブランドネイビー(実結果と同じ器)。

const NAVY = "#2E2E5C";

type Variant = "prose" | "gap" | "friends" | "cards" | "grid";

// 完成トリセツ結果ページの全セクション (順序=縦座標の対応キー)。見出しは問い形式。
const SECTIONS: { n: number; title: string; variant: Variant; teaser?: string }[] =
  [
    {
      n: 1,
      title: "みんなから見たあなたは？",
      variant: "prose",
      teaser: "まわりから見たあなたは、意外にも——",
    },
    { n: 2, title: "自分とのギャップは？", variant: "gap" },
    { n: 3, title: "あなたの強みは？", variant: "prose" },
    { n: 4, title: "あなたの取扱説明書は？", variant: "cards" },
    { n: 5, title: "あなたが恋で見せる顔は？", variant: "prose" },
    { n: 6, title: "あなたが力を発揮する場所は？", variant: "cards" },
    { n: 7, title: "友達は何て言ってる？", variant: "friends" },
    { n: 8, title: "相性がいいのは誰？", variant: "grid" },
  ];

// 本文スケルトンにだけ掛ける blur。answered が増えるほど緩む (霧が晴れる)。見出し/?/影絵は掛けない。
function bodyBlurPx(answered: number, threshold: number, revealed: boolean): number {
  const t = threshold > 0 ? Math.min(1, Math.max(0, answered / threshold)) : 0;
  const base = 3 * (1 - t);
  return revealed ? base * 0.4 : base;
}

// 「?」の散らし配置 (中央縦一列を避け、数字の背後を貫通させない)。セクション毎に左右へ散らす。
const QMARK_SCATTER: { left: string; top: string }[] = [
  { left: "58%", top: "26px" },
  { left: "22%", top: "24px" },
  { left: "60%", top: "22px" },
  { left: "30%", top: "24px" },
  { left: "56%", top: "22px" },
  { left: "24%", top: "24px" },
  { left: "62%", top: "22px" },
  { left: "34%", top: "24px" },
];

/** ヒーロー帯を実結果ふうに描くための色+キャラ。null なら従来の無彩フォールバック。 */
export interface BackdropHero {
  heroBg: string;
  codeTint: string;
}

interface TakoRewardBackdropProps {
  answered: number;
  threshold: number;
  hero?: BackdropHero | null;
}

export function TakoRewardBackdrop({
  answered,
  threshold,
  hero = null,
}: TakoRewardBackdropProps) {
  const openN = Math.ceil((SECTIONS.length * answered) / Math.max(1, threshold));

  return (
    <div aria-hidden="true">
      {/* ===== ヒーロー帯 (実 ResultHero を写す): 全幅・下端スラント・グロー・ドット・
          称号(?)・OCEAN・キャラ黒塗りシルエット。hero があれば型色帯 (本物の見た目)、
          無ければ従来の白基調無彩帯。 ===== */}
      <HeroBand hero={hero} />

      {/* ===== 結果サンプル: 解放後ページ (フェススター preview) の実キャプチャをぼかして敷く。
          スケルトン (BackdropSection) から差し替え (2026-07-18)。openN/段階リビールは
          このサンプル方式では使わない (answered/threshold は器の高さ互換のため受け続ける)。 ===== */}
      <div className="mx-auto max-w-[560px] overflow-hidden px-5 pb-16 pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tako/reward-sample.jpg"
          alt=""
          className="w-full blur-[2px]"
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  );
}

// 実ヒーロー帯 (ResultHero) と同じフェルトドット配置。
const HERO_DOTS = [
  { w: 11, h: 11, top: "15%", left: "6%" },
  { w: 8, h: 8, top: "42%", left: "9%" },
  { w: 13, h: 13, top: "20%", right: "7%" },
  { w: 8, h: 8, top: "50%", right: "10%" },
  { w: 10, h: 10, top: "72%", left: "13%" },
  { w: 7, h: 7, top: "78%", right: "15%" },
] as const;

// ヒーロー帯 (ResultHero のミラー)。hero があれば型色帯 + 実キャラの黒塗りシルエット
// (本物の結果ヒーローがそこにあるが、キャラだけ黒く伏せられている状態)。
// hero が無ければ従来の無彩帯 + マスコット影絵。
function HeroBand({ hero }: { hero: BackdropHero | null }) {
  const colored = hero !== null;
  return (
    <div
      className="relative mx-[calc(50%-50vw)] w-screen overflow-hidden pb-8 pt-9"
      style={{
        background: colored ? hero.heroBg : "#EDEFF3",
        clipPath:
          "polygon(0 0, 100% 0, 100% 100%, 0 calc(100% - clamp(24px, 3.2vw, 64px)))",
      }}
    >
      {/* 上部中央の放射状グロー (実ヒーロー帯と同じ) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[280px]"
        style={{
          background: `radial-gradient(ellipse at top center, rgba(255,255,255,${
            colored ? "0.6" : "0.75"
          }) 0%, transparent 68%)`,
        }}
      />
      {/* フェルトドット (実ヒーロー帯と同じ半透明白) */}
      {colored &&
        HERO_DOTS.map((d, i) => (
          <span
            key={i}
            className="pointer-events-none absolute rounded-full"
            style={{
              background: "rgba(255,255,255,0.55)",
              width: d.w,
              height: d.h,
              top: d.top,
              ...("left" in d ? { left: d.left } : { right: d.right }),
            }}
          />
        ))}
      <div className="relative mx-auto flex max-w-[560px] flex-col items-center px-5">
        {colored ? (
          <>
            {/* 見出し (称号・OCEAN コードの伏せバーは置かない。主役は ○ に ?)。 */}
            <p className="mb-1 text-[24px] font-extrabold tracking-[0.02em] text-white md:text-[30px]">
              友達から見た性格タイプ:
            </p>
          </>
        ) : (
          <>
            {/* label + 称号(?) */}
            <p className="mb-1 text-[15px] font-bold" style={{ color: "#8A90A0" }}>
              友達から見たあなたのキャラ
            </p>
            {/* 称号プレースホルダ (型名=伏せる) */}
            <div className="h-7 w-52 rounded-full" style={{ background: "#DDE0E6" }} />
            {/* OCEAN コード行 (5マーク・スコア依存＝伏せる) */}
            <div className="mt-2.5 flex items-baseline gap-2">
              {[30, 20, 30, 20, 30].map((h, i) => (
                <span
                  key={i}
                  className="rounded-full"
                  style={{ width: 12, height: h * 0.5, background: "#D3D6DE" }}
                />
              ))}
            </div>
          </>
        )}
        {colored ? (
          /* キャラは半透明の白丸 + 大きな ? (正体は解放まで秘密)。 */
          <div
            className="mt-5 flex items-center justify-center rounded-full"
            style={{
              width: "min(56vw, 240px)",
              height: "min(56vw, 240px)",
              background: "rgba(255,255,255,0.6)",
            }}
          >
            <span
              className="font-black leading-none"
              style={{ fontSize: "min(28vw, 120px)", color: hero.heroBg }}
            >
              ?
            </span>
          </div>
        ) : (
          /* 等身大キャラ影絵 + 大きな ? (誰か分からないが確かにそこにいる) */
          <div className="relative mt-4" style={{ width: 200, height: 200 }}>
            <MascotSilhouette size={200} />
            <span
              className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 font-black"
              style={{
                fontSize: 96,
                lineHeight: 1,
                color: "rgba(255,255,255,0.95)",
              }}
            >
              ?
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// 1 番号付きセクション (実結果の見出し行を写す): バッジ + 見出し + (teaser) + 本文(blur) + ?。
function BackdropSection({
  n,
  index,
  title,
  variant,
  teaser,
  revealed,
  bodyBlur,
}: {
  n: number;
  index: number;
  title: string;
  variant: Variant;
  teaser?: string;
  revealed: boolean;
  bodyBlur: number;
}) {
  const q = QMARK_SCATTER[index % QMARK_SCATTER.length];
  return (
    <section className="relative mb-14">
      {/* 見出し行 (実結果と同一): 番号バッジ (h-10 w-10 border-[3px]) + 見出し。 */}
      <div className="mb-4 flex items-center gap-3">
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] text-lg font-black"
          style={{ borderColor: NAVY, color: NAVY, opacity: 0.9 }}
        >
          {n}
        </span>
        <h2
          className="text-[26px] font-black leading-tight md:text-[32px]"
          style={{ color: NAVY, opacity: revealed ? 0.92 : 0.8 }}
        >
          {title}
        </h2>
      </div>

      {/* cliffhanger: 書き出し1行だけ読める実文 (blur無し・——で切る)。汎用文=ネタバレ無し。 */}
      {teaser && (
        <p
          className="mb-2 text-[14px] font-bold leading-snug"
          style={{ color: "#8A90A0" }}
        >
          {teaser}
        </p>
      )}

      {/* 本文スケルトン: ここだけ blur (中身は読めないまま)。 */}
      <div
        style={{
          filter: `blur(${bodyBlur.toFixed(2)}px)`,
          transition: "filter 0.5s ease",
          opacity: revealed ? 0.9 : 0.72,
        }}
      >
        <SectionBody variant={variant} revealed={revealed} />
      </div>

      {/* 「?」: blur無しで鮮明。散らし配置。revealed で消える。 */}
      {!revealed && (
        <span
          className="pointer-events-none absolute flex h-11 w-11 items-center justify-center rounded-2xl text-[28px] font-black"
          style={{
            left: q.left,
            top: teaser ? "58px" : q.top,
            color: "#6B7280",
            background: "rgba(255,255,255,0.92)",
            boxShadow: "0 6px 18px rgba(46,46,92,0.14)",
          }}
        >
          ?
        </span>
      )}
    </section>
  );
}

function bar(w: string, tone: string) {
  return { background: tone, width: w };
}

// セクション本文のスケルトン。実結果の各セクションのカード形を写す。
function SectionBody({
  variant,
  revealed,
}: {
  variant: Variant;
  revealed: boolean;
}) {
  const tone = revealed ? "#DEE1E6" : "#E8EAEE";
  switch (variant) {
    case "gap":
      // ② 自分とのギャップ = 一番のギャップ(淡ラベンダーカード) → 五つの傾向バー → 本文。
      return (
        <div>
          {/* 見せ場カード (実: rounded-3xl bg-[#F4F4FE] px-6 py-7) */}
          <div className="mb-8 rounded-3xl px-6 py-6" style={{ background: "#F4F4FE" }}>
            <div className="h-4 rounded-full" style={bar("85%", "#DFE1F1")} />
            <div className="mt-3 h-4 rounded-full" style={bar("60%", "#DFE1F1")} />
          </div>
          {/* 五つの性格傾向バー (発散バー: 中央仕切り + ノブ) */}
          <div className="space-y-3">
            {[0.62, 0.4, 0.55, 0.35, 0.58].map((pos, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-2.5 w-8 rounded-full" style={{ background: tone }} />
                <div className="relative h-2.5 flex-1 rounded-full" style={{ background: tone }}>
                  <span
                    className="absolute top-1/2 left-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2"
                    style={{ background: "#C7CAD3" }}
                  />
                  <span
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full"
                    style={{ background: "#C2C6D0", left: `${pos * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {/* 本文 */}
          <div className="mt-5 space-y-2">
            {[0.95, 0.7].map((w, i) => (
              <div key={i} className="h-3 rounded-full" style={bar(`${w * 100}%`, tone)} />
            ))}
          </div>
        </div>
      );
    case "friends":
      // ③ 友達からの回答 = 評価者一覧の行 (アバター + 名前 + バッジ)。
      return (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
              style={{ background: "#F3F4F7" }}
            >
              <div className="h-10 w-10 rounded-full" style={{ background: tone }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 rounded-full" style={bar("40%", tone)} />
                <div className="h-2.5 rounded-full" style={bar("72%", tone)} />
              </div>
            </div>
          ))}
        </div>
      );
    case "cards":
      // 強み/取扱注意/キャリア = 2列カードグリッド (実結果の見せ場カード群)。
      return (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl px-4 py-3"
              style={{ background: "#F3F4F7" }}
            >
              <div className="h-3 rounded-full" style={bar("55%", tone)} />
              <div className="mt-2 h-2.5 rounded-full" style={bar("90%", tone)} />
              <div className="mt-1.5 h-2.5 rounded-full" style={bar("70%", tone)} />
            </div>
          ))}
        </div>
      );
    case "grid":
      // 相性ランキング = 3列のキャラ枠グリッド (アバター + 名前バー)。
      return (
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="h-14 w-14 rounded-full" style={{ background: tone }} />
              <div className="h-2.5 w-10 rounded-full" style={{ background: tone }} />
            </div>
          ))}
        </div>
      );
    case "prose":
    default:
      // 本文プロース。
      return (
        <div className="space-y-2">
          {[0.96, 0.88, 0.7].map((w, i) => (
            <div key={i} className="h-3 rounded-full" style={bar(`${w * 100}%`, tone)} />
          ))}
        </div>
      );
  }
}

// 中立的なマスコットの“影絵”(インラインSVG・単色1枚・画像読み込み無し)。型を特定させない。
function MascotSilhouette({ size = 72 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="shrink-0" aria-hidden="true">
      <g fill="#4B5162">
        <circle cx="21.5" cy="18" r="8.5" />
        <circle cx="42.5" cy="18" r="8.5" />
        <path d="M32 13c11.5 0 19.5 8.4 19.5 20.5C51.5 47 43.5 54.5 32 54.5S12.5 47 12.5 33.5C12.5 21.4 20.5 13 32 13z" />
      </g>
    </svg>
  );
}
