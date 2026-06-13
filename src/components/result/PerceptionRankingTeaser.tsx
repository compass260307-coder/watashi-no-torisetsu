// 相互理解度ページ末尾の「相性ランキング風ぼかしティーザー」CTA。
//
// 旧・紫枠シェアCTA (PerceptionBoostCta、温存) を置き換える格上げ版。koigram の
// 「あなたとの相性ランキング」CTA の見せ方 (もこもこ見出し + 上位3枠ぼかし予告 +
// メインボタン) を参考に、ブランドは watashi-torisetsu で統一:
//   文字 deepPurple #3A2D6B / CTA sunYellow #FFE993 / アクセント vividPink #FE3C72 /
//   logoBlue・skyBlue #0094D8 / ロゴ風 wtr-logo-text / 二人称「アナタ」/ 絵文字不使用 SVG。
//
// ★ ランキング3枠は完全ダミー (実データ非参照)。友達0〜1人でも常に3枠が埋まる。
//   強めの blur で個人情報に見えない (ダミー名・数値は判読不能)。aria-hidden で装飾扱い。
// ★ ぼかしは課金/シェアロックではない。ボタンは普通にハブページへ遷移するだけ。

import Link from "next/link";

interface PerceptionRankingTeaserProps {
  /** 友達評価ハブ (QR + 相互理解度ランキング) への遷移先パス。 */
  hubHref: string;
}

// 順位ごとの色 (1=sunYellow / 2=skyBlue系 / 3=vividPink系)
const RANK_COLORS = ["#FFE993", "#0094D8", "#FE3C72"] as const;
// ダミー名・%帯の幅 (見た目の変化づけだけ。中身に意味はない)
const DUMMY_ROWS = [
  { nameW: "62%", pct: "92%", barW: "84%" },
  { nameW: "48%", pct: "85%", barW: "71%" },
  { nameW: "56%", pct: "78%", barW: "63%" },
] as const;

export function PerceptionRankingTeaser({
  hubHref,
}: PerceptionRankingTeaserProps) {
  return (
    <section className="mb-8">
      {/* ===== ヒーロー見出し (ロゴ風もこもこ + 花/ハート装飾) ===== */}
      <div className="flex flex-col items-center mb-4">
        <div className="flex flex-nowrap items-center justify-center gap-1.5 max-w-full px-1">
          <FlowerIcon />
          <span
            className="wtr-logo-text leading-none min-w-0"
            style={{ fontSize: "clamp(13px, 4.2vw, 22px)", whiteSpace: "nowrap" }}
          >
            アナタとの相性ランキング
          </span>
          <HeartIcon />
        </div>
        <p className="text-[#3A2D6B]/70 font-bold text-xs mt-1.5 text-center">
          友達が答えるほど、トップ3が埋まっていく
        </p>
      </div>

      {/* ===== ぼかしランキング (完全ダミー・飾り) ===== */}
      <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
        <ul className="flex flex-col gap-3" aria-hidden="true">
          {DUMMY_ROWS.map((row, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-2xl bg-[#F5F2FF] px-3 py-2.5"
            >
              {/* 順位バッジ (くっきり = ここだけ読める) */}
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-sm"
                style={{ backgroundColor: RANK_COLORS[i] }}
              >
                {i + 1}
              </span>
              {/* 中身はすべて強めの blur (ダミー名・数値は判読不能) */}
              <div
                className="flex-1 flex items-center gap-3 blur-[6px] select-none pointer-events-none"
                style={{ filter: "blur(6px)" }}
              >
                {/* ぼかしアバター円 */}
                <span className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-[#BCDEF8] to-[#B7A8EC]" />
                {/* ぼかし名前帯 + ぼかしバー */}
                <div className="flex-1">
                  <span
                    className="block h-3 rounded-full bg-[#3A2D6B]/30 mb-1.5"
                    style={{ width: row.nameW }}
                  />
                  <span
                    className="block h-2.5 rounded-full bg-[#0094D8]/35"
                    style={{ width: row.barW }}
                  />
                </div>
                {/* ぼかし%帯 */}
                <span className="flex-shrink-0 text-[#FE3C72] font-black text-base">
                  {row.pct}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {/* ===== メインボタン (sunYellow chunky) ===== */}
        <Link
          href={hubHref}
          className="mt-5 block w-full bg-[#FFE993] text-[#3A2D6B] font-black text-base px-6 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all text-center"
        >
          相性ランキングを見る →
        </Link>
      </div>
    </section>
  );
}

// 花 (TrisetsuNameTag と同一)。ヒーロー見出しの左に置く装飾。
function FlowerIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <g fill="#B7A8EC">
        <ellipse cx="12" cy="5" rx="3.2" ry="4.6" />
        <ellipse cx="12" cy="19" rx="3.2" ry="4.6" />
        <ellipse cx="5" cy="12" rx="4.6" ry="3.2" />
        <ellipse cx="19" cy="12" rx="4.6" ry="3.2" />
      </g>
      <circle cx="12" cy="12" r="3.6" fill="#FFE07A" />
    </svg>
  );
}

// ハート (TrisetsuNameTag と同一)。ヒーロー見出しの右に置く装飾。
function HeartIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path
        d="M12 21C12 21 3 14 3 8.5 3 5.5 5.2 3.5 7.8 3.5 9.6 3.5 11.1 4.6 12 6 12.9 4.6 14.4 3.5 16.2 3.5 18.8 3.5 21 5.5 21 8.5 21 14 12 21 12 21Z"
        fill="#FE8FB0"
      />
    </svg>
  );
}
