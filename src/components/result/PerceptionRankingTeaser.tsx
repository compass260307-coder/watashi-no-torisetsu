// 相互理解度ページ末尾の「相性ランキング風ティーザー」CTA。
//
// 旧・紫枠シェアCTA (PerceptionBoostCta、温存) を置き換える格上げ版。見出しロゴ +
// 上位3枠の「完成見本」プレビュー + メインボタン。ブランドは watashi-torisetsu で統一:
//   文字 deepPurple #2E2E5C / CTA sunYellow #5B5BEF / 二人称「アナタ」/ 絵文字不使用。
//
// 見出しは生成済みロゴ画像 (/heading-ranking.png、羊毛フェルト風・透過2行) を next/image で
// 表示 (ヒーロー heading-friend-invite.png と同方式)。
//
// ★ ランキング3枠は完全ダミー (実データ非参照)。友達0〜1人でも常に3枠が埋まる。
//   「埋まったらこうなる」完成見本として弱い blur + opacity でうっすら見せる。汎用名
//   「ともだち A/B/C」で実在の友達と誤解されない。aria-hidden で装飾扱い。
// ★ blur は課金/シェアロックではない。ボタンは普通にハブページへ遷移するだけ。
//
// 順位バッジは金・銀・銅メダル (共通コンポーネント RankMedalBadge)。実ランキング
// (/friend-evaluation) と同一見た目で統一。

import Image from "next/image";
import Link from "next/link";
import { RankMedalBadge } from "./RankMedalBadge";

interface PerceptionRankingTeaserProps {
  /** 友達評価ハブ (QR + 相互理解度ランキング) への遷移先パス。 */
  hubHref: string;
}

// ダミー見本データ (汎用名 + 80%台の自然な降順。実在の友達と誤解されない)
const DUMMY_ROWS = [
  { name: "ともだち A", pct: "88%" },
  { name: "ともだち B", pct: "82%" },
  { name: "ともだち C", pct: "79%" },
] as const;

export function PerceptionRankingTeaser({
  hubHref,
}: PerceptionRankingTeaserProps) {
  return (
    <section className="mb-8">
      {/* ===== 見出しロゴ画像 (生成済み透過PNG・2行) =====
          -mx-6 でカード内余白いっぱいまで広げて拡大 (375px 内に収まる範囲)。 */}
      <div className="-mx-6 mb-3">
        <Image
          src="/heading-ranking.webp"
          alt="相互理解度ランキングが見れるようになりました！"
          width={2078}
          height={555}
          className="w-full max-w-[360px] h-auto mx-auto"
        />
      </div>

      {/* ===== ランキング完成見本 (完全ダミー・弱 blur + opacity でうっすら) ===== */}
      <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
        <ul
          className="flex flex-col gap-1 opacity-85 select-none pointer-events-none"
          style={{ filter: "blur(2px)" }}
          aria-hidden="true"
        >
          {DUMMY_ROWS.map((row, i) => (
            <li key={i} className="flex items-center gap-3 py-2">
              {/* 順位バッジ (金・銀・銅メダル、共通コンポーネント) */}
              <RankMedalBadge rank={i + 1} size={28} />
              {/* 汎用シルエットアバター */}
              <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#E4E0F5] flex items-center justify-center overflow-hidden">
                <AvatarSilhouette />
              </span>
              {/* ダミー名 */}
              <span className="flex-1 text-[#2E2E5C] font-black text-sm">
                {row.name}
              </span>
              {/* 相互理解度 % (実ランキングと同じ sunYellow ピル) */}
              <span className="flex-shrink-0 bg-[#5B5BEF] text-white font-black rounded-full px-2.5 py-0.5 text-sm">
                {row.pct}
              </span>
            </li>
          ))}
        </ul>

        {/* ===== メインボタン (sunYellow chunky) ===== */}
        <Link
          href={hubHref}
          className="mt-5 block w-full bg-[#5B5BEF] text-white font-black text-base px-6 py-4 rounded-full shadow-[0_8px_20px_rgba(91,91,239,0.30)] hover:translate-y-0.5 hover:shadow-[0_4px_12px_rgba(91,91,239,0.30)] active:translate-y-1 active:shadow-[0_0_0_#2E2E5C] transition-all text-center"
        >
          相性ランキングを見る →
        </Link>
      </div>
    </section>
  );
}

// 汎用の人型シルエット (個人を特定しないプレースホルダ)
function AvatarSilhouette() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="text-[#2E2E5C]/45"
    >
      <circle cx="12" cy="8.5" r="4" fill="currentColor" />
      <path
        d="M4.5 20c0-4.2 3.4-7 7.5-7s7.5 2.8 7.5 7z"
        fill="currentColor"
      />
    </svg>
  );
}
