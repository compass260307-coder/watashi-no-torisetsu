// 順位バッジ (金・銀・銅メダル風) の共通コンポーネント。
//
// 相互理解度ランキング (/friend-evaluation) と 末尾CTAティーザー
// (/evaluate/result の PerceptionRankingTeaser) の両方から参照し、配色/質感を一元管理する。
//
// 質感: のっぺり単色にせず、上→下のグラデ (明→やや暗) + 上部の内側ハイライト
// (inset box-shadow) + 細い縁取り + ごく薄い影で、ぽってり可愛いメダル風に。
// ブランド (M PLUS Rounded・kawaii) に馴染む範囲。数字は背景とコントラストを確保。
//   1位=ゴールド / 2位=シルバー / 3位=ブロンズ / 4位以降=淡いラベンダー (メダル3色と非干渉)。

interface Medal {
  from: string; // グラデ上端 (明)
  to: string; // グラデ下端 (やや暗)
  border: string; // 縁取り
  fg: string; // 数字色
  ts?: string; // 数字の text-shadow (任意・ブロンズの白文字用)
}

const MEDALS: Record<1 | 2 | 3, Medal> = {
  1: { from: "#F7D56E", to: "#E3A82A", border: "#C88E18", fg: "#6B4A00" }, // gold
  2: { from: "#EAEDF2", to: "#AAB2BE", border: "#9AA2AF", fg: "#494E58" }, // silver
  3: {
    from: "#E2A87C",
    to: "#B26E3A",
    border: "#9C5C2C",
    fg: "#FFFFFF",
    ts: "0 1px 1px rgba(74,42,12,0.45)",
  }, // bronze
};

// 4位以降 (空き枠など): メダル3色と被らない控えめなラベンダー。
const PLAIN: Medal = {
  from: "#ECE9F8",
  to: "#D8D2EE",
  border: "#CFC8EA",
  fg: "#2E2E5C",
};

export function RankMedalBadge({
  rank,
  size = 32,
}: {
  rank: number;
  size?: number;
}) {
  const m = MEDALS[rank as 1 | 2 | 3] ?? PLAIN;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-black flex-shrink-0 leading-none"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(to bottom, ${m.from}, ${m.to})`,
        color: m.fg,
        border: `1.5px solid ${m.border}`,
        boxShadow:
          "inset 0 1.5px 0 rgba(255,255,255,0.55), 0 1px 2px rgba(58,45,107,0.20)",
        fontSize: size >= 32 ? 14 : 12,
        textShadow: m.ts,
      }}
      aria-label={`${rank} 位`}
    >
      {rank}
    </span>
  );
}
