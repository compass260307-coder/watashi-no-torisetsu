// 相性診断の診断中の画面の絵 (DiagnosisAnalyzingLoader の visual に渡す)。
//   - 選んだ2キャラが左右から近づいて、交互にぴょこぴょこ跳ねる。
//   - 全体を白いカード1枚にまとめる (自己診断の解析待ち画面の紹介スライドと同じ、白い角丸のカード)。
//   - まんなかの淡いハートに、下からピンクがたまっていく (= 診断の進み具合)。
//     たまりきる瞬間に弾けて、そのまま結果へ切り替わる。
//   - その下で、結果の「ふたりのバランス」と同じ5つの視点に、順に色とチェックが入る。
// 動きはすべて CSS (AishoAnalyzingVisual.module.css)。長さは totalMs に合わせる。
import type { CSSProperties } from "react";
import { SmoothImage } from "@/components/ui/SmoothImage";
import styles from "./AishoAnalyzingVisual.module.css";

const NAVY = "#2E2E5C";
const PINK = "#EC6C9C";
const PINK_PALE = "#FBDCE8";
const HEART_PATH =
  "M20.8 8.6c0 4.4-7.2 9.4-8.8 10.4-1.6-1-8.8-6-8.8-10.4a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z";

// 立ちのぼる小さなハート (左右の位置・流れる向き・出るタイミング)
const RISING = [
  { left: "8%", dx: "-12px", delay: 1.0, size: 14 },
  { left: "58%", dx: "12px", delay: 1.75, size: 17 },
  { left: "36%", dx: "-3px", delay: 2.5, size: 12 },
];
// 弾けるときのきらめき (飛ぶ先)
const SPARKS = [
  { dx: "-46px", dy: "-34px" },
  { dx: "46px", dy: "-34px" },
  { dx: "-56px", dy: "8px" },
  { dx: "56px", dy: "8px" },
  { dx: "-28px", dy: "42px" },
  { dx: "28px", dy: "42px" },
];

function Heart({ fill, className, style }: { fill: string; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill={fill} className={className} style={style} aria-hidden="true">
      <path d={HEART_PATH} />
    </svg>
  );
}

function Character({
  src,
  name,
  side,
}: {
  src: string;
  name: string;
  side: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center ${
        side === "left" ? styles.enterLeft : styles.enterRight
      }`}
    >
      {/* 絵の縦横比がタイプごとに違っても、同じ正方形の枠の中央に置いて高さをそろえる */}
      <div className={`aspect-square w-full ${side === "left" ? styles.bob : styles.bobLate}`}>
        <SmoothImage
          src={src}
          alt={name}
          width={360}
          height={360}
          sizes="(min-width: 768px) 150px, 30vw"
          priority
          className="h-full w-full object-contain"
        />
      </div>
      <span
        className="mt-2.5 block w-full truncate text-center text-[13px] font-black leading-none md:text-[14px]"
        style={{ color: NAVY }}
      >
        {name}
      </span>
    </div>
  );
}

export function AishoAnalyzingVisual({
  a,
  b,
  axes,
  totalMs,
}: {
  a: { src: string; name: string };
  b: { src: string; name: string };
  // 結果の「ふたりのバランス」と同じ5つの視点 (名前と色)
  axes: { label: string; color: string }[];
  totalMs: number;
}) {
  const total = `${totalMs}ms`;
  return (
    <div
      className="mb-8 w-full max-w-[360px] rounded-[28px] bg-white px-5 pb-5 pt-6 shadow-[0_14px_40px_rgba(214,120,158,0.18)] md:max-w-[420px] md:px-7 md:pb-6 md:pt-7"
      style={{ "--total": total } as CSSProperties}
    >
      <div className="flex w-full items-start justify-center gap-3 md:gap-4">
        <Character src={a.src} name={a.name} side="left" />

        {/* ハート。キャラの絵 (正方形) の高さの中央に置く */}
        <div className="flex aspect-[1/1.6] w-[22%] shrink-0 items-center" aria-hidden="true">
          <div className="relative aspect-square w-full">
            {RISING.map((h, i) => (
              <Heart
                key={i}
                fill="#F7A3C2"
                className={`absolute -top-1 ${styles.rise}`}
                style={
                  {
                    left: h.left,
                    width: h.size,
                    height: h.size,
                    animationDelay: `${h.delay}s`,
                    "--dx": h.dx,
                  } as CSSProperties
                }
              />
            ))}
            <span
              className={`absolute inset-0 rounded-full border-[3px] ${styles.burstRing}`}
              style={{ borderColor: PINK }}
            />
            {SPARKS.map((s, i) => (
              <span
                key={i}
                className={`absolute left-1/2 top-1/2 -ml-1 -mt-1 h-2 w-2 rounded-full ${styles.burstSpark}`}
                style={{ backgroundColor: i % 2 ? "#F6C544" : PINK, "--dx": s.dx, "--dy": s.dy } as CSSProperties}
              />
            ))}
            <div className={`absolute inset-0 ${styles.heart}`}>
              <svg viewBox="0 0 24 24" className="absolute h-0 w-0" aria-hidden="true">
                <defs>
                  <linearGradient id="aisho-heart-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#F58DB3" />
                    <stop offset="1" stopColor={PINK} />
                  </linearGradient>
                </defs>
              </svg>
              <Heart fill={PINK_PALE} className="absolute inset-0 h-full w-full" />
              <Heart
                fill="url(#aisho-heart-fill)"
                className={`absolute inset-0 h-full w-full ${styles.heartFill}`}
              />
            </div>
          </div>
        </div>

        <Character src={b.src} name={b.name} side="right" />
      </div>

      {/* 5つの視点: 進みに合わせて左から順に色がつく */}
      <ul
        className="mt-5 grid grid-cols-5 gap-1 border-t pt-4 md:mt-6 md:pt-5"
        style={{ borderColor: PINK_PALE }}
        aria-hidden="true"
      >
        {axes.map((axis, i) => {
          // 5つ目は、ハートが弾ける少し前に付く
          const at = `${Math.round((totalMs * (i + 1)) / (axes.length + 0.6))}ms`;
          return (
            <li key={axis.label} className="flex flex-col items-center" style={{ "--at": at } as CSSProperties}>
              {/* 付く前は、その視点の色をごく淡く敷いておく */}
              <span
                className="relative flex h-9 w-9 items-center justify-center rounded-full md:h-10 md:w-10"
                style={{ backgroundColor: `${axis.color}24` }}
              >
                <span
                  className={`absolute inset-0 rounded-full ${styles.chipFill}`}
                  style={{ backgroundColor: axis.color }}
                />
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`relative ${styles.chipCheck}`}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span
                className={`mt-2 text-center text-[11px] font-bold leading-[1.25] ${styles.chipLabel}`}
                style={{ color: NAVY }}
              >
                {axis.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
