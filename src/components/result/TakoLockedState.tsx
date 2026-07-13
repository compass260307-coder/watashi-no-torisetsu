"use client";

// 他己診断 (タコ診断) ページ /tako/[token] のロック空状態。
// 友達の回答が解除条件 (3人) に満たないとき表示する。
//
// 三層構造 (奥→手前):
//   1. 奥(報酬): 統合レポート結果ページの気配 (TakoRewardBackdrop・伏せ字ダミー)。
//   2. 中間(スクリム): 手前の可読性担保 (TakoRevealStage が内包)。
//   3. 手前(主役): シェア連動カウンター (TakoShareGate)。
//   → 器・パララックス・段階リビールは TakoRevealStage が担う。
//
//   その下 (通常フロー): 招待QR (CTAの着地) + 価値説明3ステップ (TakoValueSections)。
//   触れるのは QR・友達誘導・シェアのみ。課金導線・無料バイパスは一切作らない。

import { TakoShareGate, type GateAnsweredFriend } from "./TakoShareGate";
import { TakoRevealStage } from "./TakoRevealStage";
import { TakoValueSections } from "./TakoValueSections";
import { LockedInviteShare } from "./LockedInviteShare";

interface TakoLockedStateProps {
  /** 回答済み (answered) 友達。順に answered スロットへ (顔=その友達から見たあなた)。 */
  answered: GateAnsweredFriend[];
  /** 診断中 (pending) の近似人数。events から算出済み。 */
  pendingCount: number;
  threshold: number;
  inviteUrl: string;
}

export function TakoLockedState({
  answered,
  pendingCount,
  threshold,
  inviteUrl,
}: TakoLockedStateProps) {
  const answeredCount = Math.min(answered.length, threshold);

  return (
    <div>
      {/* ===== 三層ゲート (奥=報酬 / スクリム / 手前=カウンター) ===== */}
      <section className="pt-2 md:pt-4">
        <TakoRevealStage answered={answeredCount} threshold={threshold}>
          <TakoShareGate
            answered={answered}
            pendingCount={pendingCount}
            threshold={threshold}
            shownAnsweredCount={answeredCount}
          />
        </TakoRevealStage>
      </section>

      {/* ===== 招待 (QR + シェア)。CTA の着地点。 ===== */}
      <div id="tako-invite" className="mx-auto mt-8 max-w-[560px] scroll-mt-24">
        <div
          className="rounded-3xl p-6 md:px-9 md:py-7"
          style={{ background: "#EDEFFB" }}
        >
          <LockedInviteShare inviteUrl={inviteUrl} compact />
        </div>
      </div>

      {/* ===== 解放後に見えるもの (4項目グリッド) + 3ステップ (TakoValueSections) ===== */}
      <div className="mt-14 md:mt-20">
        <TakoValueSections />
      </div>
    </div>
  );
}
