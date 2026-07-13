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
//   追加機能②: 再訪リビール「◯人届いた！」(cookie既読・サーバ状態不変)。
//   追加機能③: 送信先ピッカー (TakoSendSheet)。CTA押下で即「誰に送る？」を出し、送信後は
//     空スロットを楽観的に pending へ (クライアント表示のみ・②の displayAnswered とは非干渉)。
//
//   その下 (通常フロー): 招待QR (CTAの着地) + 価値説明3ステップ (TakoValueSections)。
//   触れるのは QR・友達誘導・シェアのみ。課金導線・無料バイパスは一切作らない。

import { useState } from "react";
import { TakoShareGate, type GateAnsweredFriend } from "./TakoShareGate";
import { TakoRevealStage } from "./TakoRevealStage";
import { TakoValueSections } from "./TakoValueSections";
import { LockedInviteShare } from "./LockedInviteShare";
import { TakoSendSheet } from "./TakoSendSheet";
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
  /** プレビュー: 送信先シートのフォールバック経路を再現 ('liff-sim' 等)。 */
  previewShareMode?: string;
}

export function TakoLockedState({
  answered,
  pendingCount,
  threshold,
  inviteUrl,
  storageScope,
  ssrInitialAnswered,
  previewMode = false,
  previewShareMode,
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

  // ③ 送信先ピッカー。送った実感として空スロットを楽観的に pending へ (クライアント表示のみ)。
  //   ②とは非干渉: displayAnswered は触らず、pending 表示数だけに足す。サーバ状態も不変。
  const [sheetOpen, setSheetOpen] = useState(false);
  const [optimisticPending, setOptimisticPending] = useState(0);
  const shownPending = pendingCount + optimisticPending;

  return (
    <div>
      {/* ===== 三層ゲート (奥=報酬 / スクリム / 手前=カウンター) ===== */}
      <section className="pt-2 md:pt-4">
        <TakoRevealStage answered={displayAnswered} threshold={threshold}>
          <TakoShareGate
            answered={answered}
            pendingCount={shownPending}
            threshold={threshold}
            shownAnsweredCount={displayAnswered}
            deliveredCount={deliveredCount}
            bounceKey={bounceKey}
            revealFromIndex={revealFromIndex}
            onPrimaryAction={() => setSheetOpen(true)}
          />
        </TakoRevealStage>
      </section>

      {/* ③ 送信先ピッカー (CTA の着地。#tako-invite QR の上位動線) */}
      <TakoSendSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        inviteUrl={inviteUrl}
        toSend={Math.max(0, threshold - displayAnswered - shownPending)}
        onSent={() =>
          setOptimisticPending((p) =>
            // answered + (server pending + optimistic) が threshold を超えない範囲で増やす。
            Math.min(p + 1, Math.max(0, threshold - displayAnswered - pendingCount)),
          )
        }
        previewShareMode={previewShareMode}
      />

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
