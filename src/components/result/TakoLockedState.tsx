"use client";

// 友達診断 (タコ診断) ページ /tako/[token] のロック空状態。
// 友達の回答が解除条件 (3人) に満たないとき表示する。
//
// 三層構造 (奥→手前):
//   1. 奥(報酬): 統合レポート結果ページの気配 (TakoRewardBackdrop・伏せ字ダミー)。
//   2. 中間(スクリム): 手前の可読性担保 (TakoRevealStage が内包)。
//   3. 手前(主役): シェア連動カウンター (TakoShareGate)。
//   → 器・パララックス・段階リビールは TakoRevealStage が担う。
//
//   追加機能②: 再訪リビール「◯人届いた！」。前回見た回答者数(localStorage)より増えていたら、
//   一旦旧状態を描いてから現在値へバウンド減算 + スロット順次リビールで“勢い”を見せる。
//   真実はサーバの回答者数。既読(last_seen)だけをローカルに持ち、サーバ状態は書き換えない。
//
//   ★ロック中は「奥=結果画面 / 手前=カウンター」の2つだけ (下部の招待QR帯・価値説明は非表示)。
//   スクロールで下部セクションが現れて三層の世界観が切れるのを防ぐ。招待/シェアは CTA→送信シート
//   (③ TakoSendSheet)に集約 (QRもシート末尾に在る)。課金導線・無料バイパスは一切作らない。

import { useEffect, useRef, useState } from "react";
import { TakoShareGate, type GateAnsweredFriend } from "./TakoShareGate";
import { TakoRevealStage } from "./TakoRevealStage";
import { TakoSendSheet } from "./TakoSendSheet";
import { TakoAnsweredDetail } from "./TakoAnsweredDetail";
import { useTakoRevisitReveal } from "./useTakoRevisitReveal";
import { lineShareUrl } from "@/lib/tako-share";
import {
  thirtyTwoImagePath,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { preferFaceImage } from "@/lib/character-image";
import { heroColorsForGroup } from "@/lib/hero-colors";
import type { BackdropHero } from "./TakoRewardBackdrop";

const NAVY = "#2E2E5C";
const INACTIVE = "#9BA3B4";

// FV 右側のループ動画 (旧ロックページの FV を復活、2026-07-18)。/aisho の HeroLoopVideo と
// 同流儀 (autoPlay/muted/loop、prefers-reduced-motion で一時停止)。読み込み前でも崩れない
// よう、コンテナに淡いグラデ背景を持たせる。
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
  /** 回答済み (answered) 友達。順に answered スロットへ (顔=その友達から見たあなた)。 */
  answered: GateAnsweredFriend[];
  /** 診断中 (pending) の近似人数。events から算出済み。 */
  pendingCount: number;
  threshold: number;
  inviteUrl: string;
  /** 既読(last_seen)をスコープするキー種 (通常は owner_token)。 */
  storageScope: string;
  /** プレビュー: 送信先シートのフォールバック経路を再現 ('liff-sim' 等)。 */
  previewShareMode?: string;
  /**
   * SSRフラッシュ対策: サーバが cookie(既読) から決めた初期表示 answered 数。
   * pending 時は「旧状態」= last_seen が入るので、初期HTML自体が演出開始フレームになる。
   * 非pending 時は serverAnswered と同値。
   */
  ssrInitialAnswered: number;
  /** プレビュー時 true: cookie を書かない (再現用)。 */
  previewMode?: boolean;
  /** ④ 相性ループ Path1 の /aisho?a= に使う本人の32型。無ければ Path1 は出ない。 */
  ownerType32: ThirtyTwoTypeId | null;
  /** ④ Path2: 友達を自己診断へ誘う導線先 (診断LP=サイトルート)。 */
  selfDiagnoseUrl: string;
  ownerToken: string;
  inviteCode: string;
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
  ownerType32,
  selfDiagnoseUrl,
  ownerToken,
  inviteCode,
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

  // ③ 送信先ピッカー。mode で招待(自分を評価してもらう)/診断誘い(④Path2)を切り替え、
  //   同じ TakoSendSheet を再利用する。送った実感 = 空スロットを楽観 pending へ。
  //   ②とは非干渉: displayAnswered は触らず pending 表示数だけに足す。サーバ状態も不変。
  const [optimisticPending, setOptimisticPending] = useState(0);
  const shownPending = pendingCount + optimisticPending;
  const [sendMode, setSendMode] = useState<null | {
    kind: "invite" | "diagnose";
    friendName?: string;
  }>(null);

  // ④ answered タップの詳細シート (相性ループ)。開いている answered の index。
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const detailFriend =
    detailIndex != null ? answered[detailIndex] ?? null : null;

  // CTA の JS 無しフォールバック先 (LINE送信URL)。ハイドレーション前に押されても送信できる。
  const inviteLineHref = lineShareUrl(inviteUrl);

  // 奥のヒーロー帯を実結果ふうの型色帯 + ○に? で描くための色。友達平均キャラは
  // 未確定なので、帯色は「未知」グループのラベンダーで固定する (正体を匂わせない)。
  const backdropHero: BackdropHero = heroColorsForGroup("unknown");

  const diagnoseText = (name: string) =>
    `わたしのこと見てくれてありがとう！今度は${name}のトリセツも作ってみて。2人の相性も見れるよ`;

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
            友達に送るだけ・{threshold}人が答えると解ける
          </p>
        </div>
        <div className="mt-5 md:mt-0 md:w-[46%] md:max-w-[620px] md:shrink-0">
          <TakoHeroVideo />
        </div>
      </header>

      {/* ===== 三層ゲート (奥=報酬 / スクリム / 手前=カウンター) ===== */}
      <section className="pt-2 md:pt-4">
        <TakoRevealStage
          answered={displayAnswered}
          threshold={threshold}
          backdropHero={backdropHero}
        >
          <TakoShareGate
            answered={answered}
            pendingCount={shownPending}
            threshold={threshold}
            shownAnsweredCount={displayAnswered}
            deliveredCount={deliveredCount}
            bounceKey={bounceKey}
            revealFromIndex={revealFromIndex}
            onPrimaryAction={() => setSendMode({ kind: "invite" })}
            primaryFallbackHref={inviteLineHref}
            onAnsweredTap={(i) => setDetailIndex(i)}
            qrInviteUrl={inviteUrl}
            qrImageSrc={
              ownerType32
                ? preferFaceImage(thirtyTwoImagePath(ownerType32))
                : null
            }
            ownerToken={ownerToken}
            inviteCode={inviteCode}
          />
        </TakoRevealStage>
      </section>

      {/* ④ answered顔タップの詳細 (相性ループ 2分岐) */}
      <TakoAnsweredDetail
        open={detailIndex != null}
        onClose={() => setDetailIndex(null)}
        friend={
          detailFriend
            ? {
                name: detailFriend.name,
                perceivedImageSrc: detailFriend.imageSrc,
                perceivedType32: detailFriend.perceivedType32 ?? null,
                friendOwnType32: detailFriend.friendOwnType32 ?? null,
              }
            : null
        }
        ownerType32={ownerType32}
        onInviteToDiagnose={() => {
          // Path2: 詳細を閉じ、③シートを「診断に誘う」文脈で開く。
          const name = detailFriend?.name ?? "友達";
          setDetailIndex(null);
          setSendMode({ kind: "diagnose", friendName: name });
        }}
      />

      {/* ③ 送信先ピッカー (CTA の着地／④Path2 の診断誘い。#tako-invite QR の上位動線) */}
      <TakoSendSheet
        open={sendMode != null}
        onClose={() => setSendMode(null)}
        inviteUrl={
          sendMode?.kind === "diagnose" ? selfDiagnoseUrl : inviteUrl
        }
        toSend={Math.max(0, threshold - displayAnswered - shownPending)}
        title={
          sendMode?.kind === "diagnose"
            ? `${sendMode.friendName}さんを診断に誘う`
            : undefined
        }
        subtitle={
          sendMode?.kind === "diagnose"
            ? `${sendMode.friendName}さんが診断すると、2人の相性が見られるようになるよ`
            : undefined
        }
        shareText={
          sendMode?.kind === "diagnose"
            ? diagnoseText(sendMode.friendName ?? "友達")
            : undefined
        }
        ownerToken={ownerToken}
        inviteCode={inviteCode}
        trackingKind={
          sendMode?.kind === "diagnose"
            ? "self_diagnosis"
            : "friend_evaluation"
        }
        onSent={() => {
          // 招待(自分の評価募集)のときだけ空スロットを楽観 pending へ。
          // 診断誘い(Path2)は owner の回答者を増やさないので pending は足さない。
          if (sendMode?.kind !== "diagnose") {
            setOptimisticPending((p) =>
              Math.min(
                p + 1,
                Math.max(0, threshold - displayAnswered - pendingCount),
              ),
            );
          }
        }}
        previewShareMode={previewShareMode}
      />

      {/* ★ロック中(<3人)は下部セクション(招待QR帯・価値説明3ステップ)を出さない。
          スクロールでQR/説明が現れて三層の世界観がぶつ切りになるのを防ぐ。
          画面は「奥=結果画面 / 手前=カウンター」の2つだけ。QRは③送信シート末尾に在り、
          招待/シェアは CTA→送信シートへ集約済み(下部導線を消しても失われない)。 */}
    </div>
  );
}
