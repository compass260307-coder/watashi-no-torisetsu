// 表紙に置く「キャラクターの星座」(2026-08-05 指示)。
// 獅子座が獅子の形をしているように、その人の32タイプのキャラクター (動物) の
// シルエットを星と結び線で描く。CHARACTER_ART に手作りの星図があればそれを使い、
// 未作成の動物は称号シードの自動生成星座にフォールバックする (段階的に増やす)。
//
// 見た目は出生図と同じ言語 (金の球 + グロー + 白の細線)。線層と星層を translateZ で
// 重ね、CSSだけの3Dゆらぎ (perspective + rotateX/Y) で視差を出す。JS不要 = サーバー
// コンポーネント。主星はひとつだけ大きく、光条付きでゆっくり瞬く。
// 座標は手書きの定数 or 整数演算PRNG+丸めなので SSR/クライアント完全一致。

import { mulberry32 } from "@/lib/unmei/chart-view";

const W = 240;
const H = 120;

type Star = { x: number; y: number; r: number };
type Art = {
  stars: Star[];
  links: [number, number][]; // stars のインデックスペア
  main: number; // 主星 (光条 + 瞬き) のインデックス
};

// ===== キャラクター星座アート (手作り) =====
// viewBox 240x120。星は輪郭の要所に置き、links で星座の線をつなぐ。
// links に出てこない星 (例: 泡・目) は「浮いた星」として絵の記号になる。
// キー = 画像スラッグの動物部分 (thirtyTwoAnimalSlug)。例: jellyfish_N → "jellyfish"。
const CHARACTER_ART: Record<string, Art> = {
  // クラゲ (寄添者 = sparkle-dolphin__N / 画像 jellyfish_N)。傘のアーチ + 3本の触手。
  jellyfish: {
    stars: [
      { x: 66, y: 52, r: 2.0 }, // 0 傘の左端
      { x: 88, y: 30, r: 2.0 }, // 1 傘の左肩
      { x: 120, y: 20, r: 3.4 }, // 2 傘の頂点 = 主星
      { x: 152, y: 30, r: 2.0 }, // 3 傘の右肩
      { x: 174, y: 52, r: 2.0 }, // 4 傘の右端
      { x: 120, y: 58, r: 1.9 }, // 5 傘の下ふち中央
      { x: 82, y: 82, r: 1.9 }, // 6 左の触手 中
      { x: 74, y: 107, r: 1.6 }, // 7 左の触手 先
      { x: 118, y: 84, r: 1.9 }, // 8 中央の触手 中
      { x: 125, y: 108, r: 1.6 }, // 9 中央の触手 先
      { x: 158, y: 82, r: 1.9 }, // 10 右の触手 中
      { x: 166, y: 106, r: 1.6 }, // 11 右の触手 先
      { x: 100, y: 68, r: 1.2 }, // 12 泡 (浮いた星)
      { x: 140, y: 72, r: 1.2 }, // 13 泡 (浮いた星)
    ],
    links: [
      [0, 1], // 傘のアーチ
      [1, 2],
      [2, 3],
      [3, 4],
      [0, 5], // 傘の下ふち
      [5, 4],
      [0, 6], // 左の触手
      [6, 7],
      [5, 8], // 中央の触手
      [8, 9],
      [4, 10], // 右の触手
      [10, 11],
    ],
    main: 2,
  },
};

// 文字列 → 32bit シード (FNV-1a)。フォールバック星座の形は称号ごとに決まる。
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

// フォールバック: 称号シードの自動生成星座 (連なり + 主星 + 枝)
function genConstellation(seedStr: string): Art {
  const rnd = mulberry32(hashSeed(seedStr));
  const n = 6 + Math.floor(rnd() * 3); // 6〜8個の連なり

  const raw: { x: number; y: number }[] = [];
  let x = 0;
  let y = 60 + (rnd() - 0.5) * 40;
  for (let i = 0; i < n; i++) {
    raw.push({ x, y });
    x += 24 + rnd() * 18;
    y += (rnd() - 0.5) * 52;
  }
  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sx = (W - 40) / Math.max(1, maxX - minX);
  const sy = (H - 44) / Math.max(1, maxY - minY);
  const norm = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: Math.round((20 + (p.x - minX) * sx) * 10) / 10,
    y: Math.round((22 + (p.y - minY) * sy) * 10) / 10,
  });

  const stars: Star[] = raw.map((p) => ({ ...norm(p), r: 0 }));
  const main = 1 + Math.floor(rnd() * (n - 2));
  stars.forEach((s, i) => {
    s.r = i === main ? 3.6 : Math.round((1.7 + rnd() * 1.1) * 10) / 10;
  });

  const links: [number, number][] = stars.slice(1).map((_, i) => [i, i + 1]);
  if (n >= 7) {
    const m = stars[main];
    const bx = Math.round(Math.min(W - 14, Math.max(14, m.x + (rnd() - 0.5) * 64)) * 10) / 10;
    const by =
      Math.round(
        Math.min(H - 12, Math.max(12, m.y + (rnd() < 0.5 ? -1 : 1) * (26 + rnd() * 14))) * 10,
      ) / 10;
    stars.push({ x: bx, y: by, r: Math.round((1.6 + rnd() * 0.9) * 10) / 10 });
    links.push([main, stars.length - 1]);
  }

  return { stars, links, main };
}

export function TypeConstellation({
  essence,
  characterSlug = null,
}: {
  essence: string | null;
  characterSlug?: string | null;
}) {
  const art =
    (characterSlug && CHARACTER_ART[characterSlug]) ||
    genConstellation(essence ?? "ワタシのトリセツ");
  const { stars, links, main } = art;
  const m = stars[main];

  return (
    <div
      aria-hidden="true"
      className="mx-auto w-[264px] md:w-[320px]"
      style={{ perspective: "600px" }}
    >
      <style>{`
        @keyframes tc-sway {
          0%, 100% { transform: rotateX(14deg) rotateY(-9deg); }
          50% { transform: rotateX(7deg) rotateY(9deg); }
        }
        .tc-sway { animation: tc-sway 11s ease-in-out infinite; transform-style: preserve-3d; }
        @keyframes tc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .tc-pulse { animation: tc-pulse 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .tc-sway, .tc-pulse { animation: none; } }
      `}</style>
      <div className="tc-sway relative">
        {/* 奥の層: 星座の結び線 */}
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
          {links.map(([a, b], i) => (
            <line
              key={i}
              x1={stars[a].x}
              y1={stars[a].y}
              x2={stars[b].x}
              y2={stars[b].y}
              stroke="#FFFFFF"
              strokeOpacity={0.3}
              strokeWidth={0.8}
            />
          ))}
        </svg>
        {/* 手前の層: 星 (ゆらぎで線との間に視差が出る) */}
        <div className="absolute inset-0" style={{ transform: "translateZ(26px)" }}>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
            <defs>
              <radialGradient id="tc-dot" cx="35%" cy="32%" r="75%">
                <stop offset="0%" stopColor="#FCEFB4" />
                <stop offset="55%" stopColor="#EDCF62" />
                <stop offset="100%" stopColor="#C7A63C" />
              </radialGradient>
              <radialGradient id="tc-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#EDCF62" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#EDCF62" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* 主星の光条 (ゆっくり瞬く) */}
            <g
              className="tc-pulse"
              stroke="#F5D66B"
              strokeOpacity={0.55}
              strokeWidth={0.7}
              strokeLinecap="round"
            >
              <line x1={m.x - 9} y1={m.y} x2={m.x + 9} y2={m.y} />
              <line x1={m.x} y1={m.y - 9} x2={m.x} y2={m.y + 9} />
            </g>
            {stars.map((s, i) => (
              <g key={i}>
                <circle cx={s.x} cy={s.y} r={s.r * 2.6} fill="url(#tc-glow)" />
                <circle cx={s.x} cy={s.y} r={s.r} fill="url(#tc-dot)" />
                <circle
                  cx={s.x - s.r * 0.32}
                  cy={s.y - s.r * 0.32}
                  r={s.r * 0.3}
                  fill="#FFFFFF"
                  fillOpacity={0.85}
                />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
