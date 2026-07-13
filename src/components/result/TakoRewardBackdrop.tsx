"use client";

// 三層ゲートの「奥(報酬)レイヤー」= 友達診断=統合レポート結果ページの“気配”。
//   ★実結果ページは生レンダリングしない。パフォーマンスとぼかし品質のため、
//     実結果ページのセクション順序と縦リズムをミラーした軽量ダミーDOMを敷く。
//   ★中身は伏せる: 各セクションは「?」プレースホルダ。answered が増えるたびに
//     openN = ceil(total * answered / threshold) 個だけ本物風ティザーへ差し替える(段階リビール)。
//   ★奥全体の blur / brightness / saturate も answered に応じて緩め、奥が晴れていく。
//
//   本物のセクションと座標的に対応させる: 同じ順(キャラ→みんなの目→ギャップ→強み→
//   取扱注意→恋愛→キャリア→友達の回答→相性)で並べ、「?だった所が読めるようになった」を成立させる。
//   ※報酬が未生成(3人未満)なので中身はサンプル。実データは解放後の結果ページ遷移先で見せる。
//
// 色は既存フェルトトークン内(NAVY / ラベンダー系 / 淡グレー)。新規カラーは足さない。
// 親 /tako ページは白背景固定のため light 前提。ダーク時も破綻しないよう強い絶対色は避ける。

const NAVY = "#2E2E5C";

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

// answered(0..threshold) から奥レイヤー全体の霧(フィルタ)を線形補間で決める。
// ★2026-07-13: 霧を大幅に薄く。0人でも「読めないが“?の並んだ結果ページ”だと分かる」境界に。
//   スクリムを廃止したぶん、フィルタは軽く (blur 0人=3.5px→3人0 / brightness/saturate もほぼ等倍)。
function fogFilter(answered: number, threshold: number): string {
  const t = threshold > 0 ? Math.min(1, Math.max(0, answered / threshold)) : 0;
  const blur = (3.5 * (1 - t)).toFixed(2);
  const brightness = (0.97 + 0.03 * t).toFixed(3);
  const saturate = (0.85 + 0.15 * t).toFixed(3);
  return `blur(${blur}px) brightness(${brightness}) saturate(${saturate})`;
}

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
    <div
      className="mx-auto w-full max-w-[560px] px-5 pb-16"
      style={{ filter: fogFilter(answered, threshold), transition: "filter 0.5s ease" }}
      aria-hidden="true"
    >
      {SECTIONS.map((s, i) => (
        <BackdropSection
          key={s.title}
          title={s.title}
          variant={s.variant}
          revealed={i < openN}
        />
      ))}
    </div>
  );
}

// 1セクション分のスケルトン。revealed=true でタイトルを出し「?」を外す(=読めるようになった)。
function BackdropSection({
  title,
  variant,
  revealed,
}: {
  title: string;
  variant: Variant;
  revealed: boolean;
}) {
  return (
    <section className="relative mb-4">
      {/* タイトル行 (revealed のときだけ読める。伏せ時はグレーバー) */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-block h-6 w-6 rounded-full"
          style={{ background: revealed ? "#E7ECFB" : "#E3E5EE" }}
        />
        {revealed ? (
          <span
            className="text-[17px] font-black"
            style={{ color: NAVY, opacity: 0.9 }}
          >
            {title}
          </span>
        ) : (
          <span
            className="h-3.5 w-32 rounded-full"
            style={{ background: "#E3E5EE" }}
          />
        )}
      </div>

      {/* 本文スケルトン */}
      <div style={{ opacity: revealed ? 0.75 : 0.5 }}>
        <SectionSkeleton variant={variant} revealed={revealed} />
      </div>

      {/* 伏せ字「?」オーバーレイ (revealed で消える)。好奇心のフックなので大きめ・高コントラストで、
          フロストのカード越しでも“?”と認識できるようにする。 */}
      {!revealed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-[30px] font-black"
            style={{
              color: "#7C86A8",
              background: "rgba(255,255,255,0.72)",
              boxShadow: "0 6px 18px rgba(46,46,92,0.12)",
            }}
          >
            ?
          </span>
        </div>
      )}
    </section>
  );
}

function bar(w: string, tone = "#E9ECF7") {
  return { background: tone, width: w };
}

function SectionSkeleton({
  variant,
  revealed,
}: {
  variant: Variant;
  revealed: boolean;
}) {
  const tone = revealed ? "#E1E6F5" : "#EAEDF7";
  switch (variant) {
    case "hero":
      return (
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 shrink-0 rounded-full"
            style={{ background: revealed ? "#E7ECFB" : "#EAEDF7" }}
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
            <div
              key={i}
              className="h-10 rounded-xl"
              style={{ background: tone }}
            />
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
            <div
              key={i}
              className="h-9 rounded-xl"
              style={{ background: tone }}
            />
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
