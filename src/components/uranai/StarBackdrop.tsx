// /unmei 結果ページ全体の固定星空 (2026-08-05 指示: ページ全体を夜空の世界観に)。
// position: fixed なのでコンテンツがスクロールしても星は動かず、それ自体が
// 「無限に遠い背景」のパララックスになる (JS不要のサーバーコンポーネント)。
// 手前で動く星は NatalChartStage のスクロール連動レイヤーが担当する。
//
// 重なり: TopHeader (z-50) / BottomNav より下、main の地色 (#17172E) より上に置くため、
// main 側で「backdrop → relative なコンテンツ」の順に描く (z-index は使わない)。

import { makeStarField } from "@/lib/unmei/chart-view";

// 奥(多く淡い) + 手前(少なく明るい) を1枚に合成
const STARS = [
  ...makeStarField(101, 110, 0.2, 0.2),
  ...makeStarField(202, 50, 0.32, 0.34),
];

export function StarBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0">
      {/* 天頂の淡い光だまり (ドームの奥行き) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 130% 55% at 50% -8%, rgba(96,96,170,0.38), rgba(23,23,46,0) 62%)",
        }}
      />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" fillOpacity={s.o} />
        ))}
      </svg>
    </div>
  );
}
