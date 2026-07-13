"use client";

// 三層ゲートの「奥(報酬)レイヤー」= 友達診断=統合レポート結果ページの“気配”。
//   ★実結果ページは生レンダリングしない。実結果のセクション順序と縦リズムをミラーした
//     軽量ダミーDOMを敷く。
//   ★「構造と?は分かる／中身は読めない」を作る (2026-07-13 実機FB反映):
//     - 見出し(項目名)は常時うっすら表示 → 「これは自分の結果ページだ」と気づける。
//     - 「?」は blur を掛けず鮮明に出す → 好奇心のフック。
//     - 本文スケルトンだけに blur を効かせ、中身は読めないまま (ネタバレしない)。
//   ★段階リビール: answered が増えるたびに openN = ceil(total*answered/threshold) 個の
//     セクションから「?」が外れ、本文 blur も緩む (霧が晴れていく)。
//
//   本物のセクションと座標的に対応 (キャラ→みんなの目→ギャップ→強み→取扱注意→恋愛→
//   キャリア→友達の回答→相性)。※中身はサンプル。実データは解放後の結果ページ遷移先。
//
// 色は白基調・無彩 (紫みは撤去)。紫アクセントは手前(数字/CTA)だけに残す。

type Variant = "hero" | "prose" | "chart" | "cards" | "list" | "grid";

// 実結果ページ構成に対応するセクション列 (順序=縦座標の対応キー)。
const SECTIONS: { title: string; variant: Variant }[] = [
  { title: "あなたのキャラ", variant: "hero" },
  { title: "みんなの目に映るあなた", variant: "prose" },
  { title: "自分とのギャップ", variant: "chart" },
  { title: "強み", variant: "prose" },
  { title: "取扱注意", variant: "cards" },
  { title: "恋愛での取扱い", variant: "prose" },
  { title: "キャリア・向いてること", variant: "cards" },
  { title: "友達からの回答", variant: "list" },
  { title: "相性ランキング", variant: "grid" },
];

// 本文スケルトンにだけ掛ける blur。answered が増えるほど緩む (霧が晴れる)。
// ★見出し/「?」には掛けない (それらは鮮明のまま)。
function bodyBlurPx(answered: number, threshold: number, revealed: boolean): number {
  const t = threshold > 0 ? Math.min(1, Math.max(0, answered / threshold)) : 0;
  const base = 3 * (1 - t); // 0人:3px → 3人:0
  return revealed ? base * 0.4 : base; // 開いたセクションは更に緩める
}

// 「?」の配置。中央縦一列にせず、各セクションで左右に散らす (実結果ページのレイアウト風)。
// 手前カードの真裏(中央)に来る?は不透明カードで自然に隠れ、左右に散った?だけが覗く。
const QMARK_SCATTER: { left: string; top: string }[] = [
  { left: "56%", top: "26px" },
  { left: "18%", top: "22px" },
  { left: "64%", top: "20px" },
  { left: "30%", top: "22px" },
  { left: "60%", top: "24px" },
  { left: "20%", top: "22px" },
  { left: "58%", top: "24px" },
  { left: "34%", top: "22px" },
  { left: "62%", top: "22px" },
];

interface TakoRewardBackdropProps {
  answered: number;
  threshold: number;
}

export function TakoRewardBackdrop({
  answered,
  threshold,
}: TakoRewardBackdropProps) {
  const openN = Math.ceil((SECTIONS.length * answered) / Math.max(1, threshold));

  return (
    <div className="mx-auto w-full max-w-[520px] px-5 pb-16" aria-hidden="true">
      {SECTIONS.map((s, i) => (
        <BackdropSection
          key={s.title}
          index={i}
          title={s.title}
          variant={s.variant}
          revealed={i < openN}
          bodyBlur={bodyBlurPx(answered, threshold, i < openN)}
        />
      ))}
    </div>
  );
}

// 1セクション: 見出し(常時うっすら)＋本文(blur)＋「?」(鮮明・伏せ時のみ)。
function BackdropSection({
  index,
  title,
  variant,
  revealed,
  bodyBlur,
}: {
  index: number;
  title: string;
  variant: Variant;
  revealed: boolean;
  bodyBlur: number;
}) {
  const q = QMARK_SCATTER[index % QMARK_SCATTER.length];
  return (
    <section className="relative mb-4">
      {/* 見出し行: 項目名は常時うっすら表示 (何のページか分かる)。開くと少し濃くなる。 */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-block h-6 w-6 rounded-full"
          style={{ background: "#E4E6EA" }}
        />
        <span
          className="text-[16px] font-black"
          style={{ color: revealed ? "#7E8494" : "#AEB3BF" }}
        >
          {title}
        </span>
      </div>

      {/* 本文スケルトン: ここだけ blur。中身(バー)は読めないまま。 */}
      <div
        style={{
          filter: `blur(${bodyBlur.toFixed(2)}px)`,
          transition: "filter 0.5s ease",
          opacity: revealed ? 0.85 : 0.65,
        }}
      >
        <SectionSkeleton variant={variant} revealed={revealed} />
      </div>

      {/* 「?」オーバーレイ: blur を掛けず鮮明に (好奇心のフック)。revealed で消える。
          中央縦一列にせず QMARK_SCATTER で各セクション左右に散らす → 数字の背後を貫通しない。
          中央付近の?は不透明カードで自然に隠れ、左右に散った?だけが覗く。 */}
      {!revealed && (
        <span
          className="pointer-events-none absolute flex h-11 w-11 items-center justify-center rounded-2xl text-[28px] font-black"
          style={{
            left: q.left,
            top: q.top,
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

function SectionSkeleton({
  variant,
  revealed,
}: {
  variant: Variant;
  revealed: boolean;
}) {
  // 無彩の淡グレー (紫み撤去)。開くと少しだけ濃く。
  const tone = revealed ? "#DEE1E6" : "#E8EAEE";
  switch (variant) {
    case "hero":
      return (
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 shrink-0 rounded-full"
            style={{ background: tone }}
          />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 rounded-full" style={bar("70%", tone)} />
            <div className="h-3 rounded-full" style={bar("90%", tone)} />
          </div>
        </div>
      );
    case "chart":
      return (
        <div className="space-y-2">
          {[0.9, 0.65, 0.8].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-2.5 w-10 rounded-full" style={bar("100%", tone)} />
              <div
                className="h-2.5 rounded-full"
                style={bar(`${w * 100}%`, tone)}
              />
            </div>
          ))}
        </div>
      );
    case "cards":
      return (
        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="h-10 rounded-xl" style={{ background: tone }} />
          ))}
        </div>
      );
    case "list":
      return (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="h-7 w-7 rounded-full"
                style={{ background: tone }}
              />
              <div className="h-3 flex-1 rounded-full" style={bar("100%", tone)} />
            </div>
          ))}
        </div>
      );
    case "grid":
      return (
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 rounded-xl" style={{ background: tone }} />
          ))}
        </div>
      );
    case "prose":
    default:
      return (
        <div className="space-y-2">
          {[0.95, 0.7].map((w, i) => (
            <div
              key={i}
              className="h-3 rounded-full"
              style={bar(`${w * 100}%`, tone)}
            />
          ))}
        </div>
      );
  }
}
