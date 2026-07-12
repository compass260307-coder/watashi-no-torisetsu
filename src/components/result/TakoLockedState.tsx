"use client";

// 他己診断 (タコ診断) ページ /tako/[token] のロック空状態。
// 友達の回答が解除条件 (3人) に満たないとき表示する。
//   - FV (2026-07-07): /aisho と同じ「左=見出し / 右=ループ動画」ヒーロー。
//     PC 横並び (見出し flex-1 / 動画 46%)、SP 縦積み (見出し→動画)。色は #2E2E5C 基準。
//   - FV の下: ロックカード (鍵/進捗) + QR 招待 (LockedInviteShare)。/me のロック表現に統一。
//     背景はネイビー階調のダミーを blur した「この先に結果がある」チラ見せ。
//   - 触れるのは QR・友達誘導・シェアのみ (LockedInviteShare が担う)。

import { SmoothImage } from "@/components/ui/SmoothImage";
import { useEffect, useRef } from "react";
import { LockedInviteShare } from "./LockedInviteShare";
import { TakoValueSections } from "./TakoValueSections";

const NAVY = "#2E2E5C";
const INACTIVE = "#9BA3B4";

const REMAINING_VISUALS = {
  1: { src: "/tako/ato-1.webp", width: 1525, height: 456 },
  2: { src: "/tako/ato-2.webp", width: 1526, height: 456 },
  3: { src: "/tako/ato-3.webp", width: 1525, height: 457 },
} as const;

type RemainingCount = keyof typeof REMAINING_VISUALS;

function remainingCount(friendCount: number, threshold: number): RemainingCount {
  const remaining = threshold - friendCount;
  if (remaining <= 1) return 1;
  if (remaining === 2) return 2;
  return 3;
}

// FV 右側のループ動画。/aisho の HeroLoopVideo と同流儀 (autoPlay/muted/loop、
// prefers-reduced-motion で一時停止)。動画ファイル (/tako/hero-loop.mp4) 生成前でも
// 崩れないよう、コンテナに淡いグラデ背景と固定アスペクトを持たせる (差し替えは source のみ)。
function TakoHeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
    }
  }, []);
  return (
    // 動画は自然な縦横比で全体を表示 (見切れ防止)。読み込み前は淡いグラデ背景。
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      className="w-full rounded-3xl object-contain"
      style={{
        background:
          "linear-gradient(135deg, #EEF0FB 0%, #F6F3FC 50%, #EAF6F9 100%)",
      }}
    >
      <source src="/tako/hero-loop.mp4" type="video/mp4" />
    </video>
  );
}

interface TakoLockedStateProps {
  friendCount: number;
  threshold: number;
  inviteUrl: string;
}

export function TakoLockedState({
  friendCount,
  threshold,
  inviteUrl,
}: TakoLockedStateProps) {
  const remaining = remainingCount(friendCount, threshold);
  const remainingVisual = REMAINING_VISUALS[remaining];

  return (
    <div>
      {/* ===== FV: /aisho と同じ「左=見出し / 右=動画」ヒーロー (最上部) ===== */}
      <header className="mb-9 md:mb-14 md:flex md:items-center md:gap-12">
        <div className="md:flex-1">
          <h1
            className="font-black text-[29px] md:text-[36px] leading-[1.45] md:leading-[1.4]"
            style={{ color: NAVY }}
          >
            自分では気づけない
            <br className="md:hidden" />
            あなたを、
            <br className="hidden md:block" />
            友達に聞いてみよう。
          </h1>
          <p
            className="mt-2.5 text-[12.5px] md:text-sm font-bold"
            style={{ color: INACTIVE }}
          >
            友達に送るだけ・3人が答えると解ける
          </p>
        </div>
        <div className="mt-5 md:mt-0 md:w-[46%] md:max-w-[620px] md:shrink-0">
          <TakoHeroVideo />
        </div>
      </header>

      {/* ===== 結果解放セクション (背景色付きの帯)。友達招待(QR)＋あと○人ビジュアル。 ===== */}
      <div className="mb-10 rounded-3xl p-6 md:mb-12 md:px-9 md:py-6" style={{ background: "#EDEFFB" }}>
        <section className="md:flex md:items-center md:gap-9 lg:gap-12">
          {/* 左: 画像 (テキストは廃し、画像で内容を伝える) */}
          <div className="md:flex-1">
            {/* あと○人ビジュアル (フェルト調イラスト・透過PNG)。friendCount に合わせて出し分ける。 */}
            <div className="-mx-2 md:mx-0 md:max-w-[560px]">
              <SmoothImage
                src={remainingVisual.src}
                alt={`あと${remaining}人の回答で結果が解放`}
                width={remainingVisual.width}
                height={remainingVisual.height}
                unoptimized
                priority
                className="h-auto w-full"
              />
            </div>
          </div>

          {/* 右: 招待 (QR + シェア)。唯一のカードとして行動を促す */}
          <div className="mt-5 md:mt-0 md:w-[38%] md:max-w-[360px] md:shrink-0">
            <LockedInviteShare inviteUrl={inviteUrl} compact />
          </div>
        </section>
      </div>

      {/* ===== 解放後に見えるもの (4項目グリッド) + 3ステップ。両セクションは
          FriendIndividualGuide と共通 (TakoValueSections)。 ===== */}
      <TakoValueSections />
    </div>
  );
}
