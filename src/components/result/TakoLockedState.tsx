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
//   追加機能②: 再訪リビール「◯人届いた！」。前回見た回答者数(cookie既読)より増えていたら、
//   一旦旧状態を描いてから現在値へバウンド減算 + スロット順次リビールで“勢い”を見せる。
//   真実はサーバの回答者数。既読(last_seen)だけを持ち、サーバ状態は書き換えない。
//   SSRフラッシュ対策は cookie 方式 (サーバが旧状態を初期HTMLとして描く / page.tsx 側)。
//
//   その下 (通常フロー): 招待QR (CTAの着地) + 価値説明3ステップ (TakoValueSections)。
//   触れるのは QR・友達誘導・シェアのみ。課金導線・無料バイパスは一切作らない。

import { TakoShareGate, type GateAnsweredFriend } from "./TakoShareGate";
import { TakoRevealStage } from "./TakoRevealStage";
import { TakoValueSections } from "./TakoValueSections";
import { LockedInviteShare } from "./LockedInviteShare";
import { useTakoRevisitReveal } from "./useTakoRevisitReveal";

interface TakoLockedStateProps {
  /** 回答済み (answered) 友達。順に answered スロットへ (顔=その友達から見たあなた)。 */
  answered: GateAnsweredFriend[];
  /** 診断中 (pending) の近似人数。events から算出済み。 */
  pendingCount: number;
  threshold: number;
  inviteUrl: string;
  /** 既読(last_seen)をスコープするキー種 (通常は owner_token)。 */
  storageScope: string;
  /**
   * SSRフラッシュ対策: サーバが cookie(既読) から決めた初期表示 answered 数。
   * pending 時は「旧状態」= last_seen が入るので、初期HTML自体が演出開始フレームになる。
   * 非pending 時は serverAnswered と同値。
   */
  ssrInitialAnswered: number;
  /** プレビュー時 true: cookie を書かない (再現用)。 */
  previewMode?: boolean;
}

export function TakoLockedState({
  answered,
  pendingCount,
  threshold,
  inviteUrl,
  storageScope,
  ssrInitialAnswered,
  previewMode = false,
}: TakoLockedStateProps) {
  const serverAnswered = Math.min(answered.length, threshold);

  // 再訪リビール: displayAnswered が演出中に ssrInitial(旧状態)→server へ動く。
  const { displayAnswered, deliveredCount, bounceKey, revealFromIndex } =
    useTakoRevisitReveal({
      serverAnswered,
      ssrInitialAnswered,
      storageScope,
      previewMode,
    });

  return (
    <div>
      {/* ===== 三層ゲート (奥=報酬 / スクリム / 手前=カウンター) ===== */}
      <section className="pt-2 md:pt-4">
        <TakoRevealStage answered={displayAnswered} threshold={threshold}>
          <TakoShareGate
            answered={answered}
            pendingCount={pendingCount}
            threshold={threshold}
            shownAnsweredCount={displayAnswered}
            deliveredCount={deliveredCount}
            bounceKey={bounceKey}
            revealFromIndex={revealFromIndex}
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
