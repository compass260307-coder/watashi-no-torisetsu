"use client";

// 友達診断 /tako のロックゲート前面カード。QRと各共有ボタンを主役にし、
// 回答が届いたときのバナーと、奥の結果を一時的にチラ見する操作をまとめる。
//
//   三層構造 (TakoRevealStage) の一番手前レイヤーとして載る。
//   ほぼ不透明カード + 影で常にくっきり浮かせる (可読性担保)。
//
// パララックス競合対策: ドラッグ開始させたくない操作要素には data-no-drag を付ける
//   (親 TakoRevealStage が pointerdown 時に closest('[data-no-drag]') を見て握らない)。

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";
import { track } from "@/lib/track";
import { withRef } from "@/lib/acquisition-link";
import { KakaoTalkGlyph } from "@/components/icons/KakaoTalkGlyph";
import { shareToKakaoTalk } from "@/lib/kakao-share";
import { useTakoPeek } from "./TakoRevealStage";
import type { ResultLocale } from "@/i18n/result";

const SHARE_TEXT =
  "友達から見たわたしを教えて！「ワタシのトリセツ」で友達診断テストができるよ";
const KO_SHARE_TEXT =
  "친구 눈에 비친 나를 알려 줘! ‘나의 사용설명서’에서 친구 진단에 답할 수 있어요.";

// シェアボタン共通の塗りピル (LockedInviteShare と同系統・アイコンのみ)。
const sharePill =
  "inline-flex flex-1 items-center justify-center rounded-full py-3 text-white transition-transform active:scale-95";

const NAVY = "#2E2E5C";
const LAVENDER = "#5B5BEF";
// フロスト(半透明)カード上で小さいグレー文字が沈まないよう、一段濃いグレー。
const READ_GRAY = "#6B7280";
const STITCH = "#C9DEF5"; // 点線ステッチ枠 (既存 friend-evaluation と同色)

export type GateAnsweredFriend = {
  perceptionId: string;
  name: string;
  /** 「その友達から見たあなた」のキャラ画像。null なら頭文字にフォールバック。 */
  imageSrc: string | null;
  /** 「その友達から見たあなた」の32型 (④ 詳細シートの表示用)。 */
  perceivedType32?: ThirtyTwoTypeId | null;
  /** その友達“本人”の32型 (Path1 相性ループ)。診断済み&リンク済みのときだけ非null。 */
  friendOwnType32?: ThirtyTwoTypeId | null;
};

interface TakoShareGateProps {
  answered: GateAnsweredFriend[];
  pendingCount: number;
  threshold: number;
  /** CTA タップ時の着地。既定は #tako-invite へスクロール (招待QRは親が描画)。 */
  onPrimaryAction?: () => void;
  /**
   * CTA の JS 無しフォールバック先 (LINE送信URL)。ハイドレーション前に押されても、
   * a要素の既定遷移でそのまま LINE 送信できる (CTA を“最初から押せる”状態にする)。
   * ハイドレーション後は onClick が既定遷移を止めて送信シートを開く。
   */
  primaryFallbackHref?: string;
  /**
   * 再訪リビール(②)用。表示する answered 数を上書きする (演出中は lastSeen→server へ動く)。
   * 未指定なら answered.length を使う。
   */
  shownAnsweredCount?: number;
  /** 「◯人届いた！」バナー用。0/未指定なら非表示。 */
  deliveredCount?: number;
  /** 数字バウンドの再発火キー (増えるたびに1回バウンド)。 */
  bounceKey?: number;
  /** この index 以上の answered スロットを順次ポップ (演出の起点 lastSeen)。 */
  revealFromIndex?: number;
  /** ④ answered スロットのタップ (相性ループ)。index は answered 配列の位置。 */
  onAnsweredTap?: (index: number) => void;
  /** 対面QR招待用の招待URL。指定するとカード内にQRを描く。 */
  qrInviteUrl?: string;
  /** QR中央に埋め込むキャラ画像 (本人の診断キャラ)。level="H" なので読取りは保たれる。 */
  qrImageSrc?: string | null;
  ownerToken: string;
  inviteCode: string;
  locale?: ResultLocale;
}

export function TakoShareGate({
  answered,
  threshold,
  shownAnsweredCount,
  deliveredCount = 0,
  bounceKey = 0,
  qrInviteUrl,
  qrImageSrc,
  ownerToken,
  inviteCode,
  locale = "ja",
}: TakoShareGateProps) {
  const isKo = locale === "ko";
  const shareText = isKo ? KO_SHARE_TEXT : SHARE_TEXT;
  const answeredCount = Math.min(
    shownAnsweredCount ?? answered.length,
    threshold,
  );
  const peek = useTakoPeek();
  const remaining = Math.max(0, threshold - answeredCount);

  // シェアボタン行 (LINE、ko は KakaoTalk / X / リンクコピー / その他)。channel 別に計測を発火。
  const [copied, setCopied] = useState(false);

  // 送信UIの露出計測 (2026-08-04): 招待未実行の内訳を「ここまでスクロールしていない」と
  // 「見たのに送らない」に分解するため、シェアボタン行が視界に半分入った時点で1回だけ発火。
  const shareRowRef = useRef<HTMLDivElement>(null);
  const uiShownFired = useRef(false);
  useEffect(() => {
    const el = shareRowRef.current;
    if (
      !el ||
      uiShownFired.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || uiShownFired.current)
          return;
        uiShownFired.current = true;
        track("tako_invite_ui_shown", {
          ownerToken,
          inviteCode,
          metadata: { surface: "locked_gate" },
        });
        io.disconnect();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ownerToken, inviteCode]);

  const fireShare = (channel: string) => {
    track("friend_invite_clicked", {
      ownerToken,
      inviteCode,
      metadata: { channel, source: "tako_locked_gate" },
    });
  };

  const copyInviteValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      // クリップボード不可環境では何もしない (QR / 他ボタンを使ってもらう)
      return false;
    }
  };

  const handleKakaoShare = async () => {
    if (!qrInviteUrl) return;
    const url = withRef(qrInviteUrl, "kakao");
    const result = await shareToKakaoTalk({
      text: shareText,
      url,
      fallbackCopy: () => copyInviteValue(url),
    });
    if (result !== "unavailable") fireShare("kakao");
  };

  const handleCopy = async () => {
    if (!qrInviteUrl) return;
    const succeeded = await copyInviteValue(withRef(qrInviteUrl, "copy"));
    if (succeeded) fireShare("copy");
  };

  const handleNativeShare = async () => {
    if (!qrInviteUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          text: shareText,
          url: withRef(qrInviteUrl, "native"),
        });
        // Web Share は完了後だけ記録し、キャンセルを招待操作に数えない。
        fireShare("native");
      } else {
        await handleCopy(); // Web Share 非対応環境はコピーにフォールバック
      }
    } catch {
      // ユーザーキャンセル等は無視
    }
  };

  return (
    <div
      // フロストガラス: 静止時は白 0.9 でがっつり主役として立たせる(奥はカード外側で見えれば
      // よく、カード越しの透過は必須ではない)。frost 質感は backdrop-blur で維持。
      // ★退避ドラッグ中、TakoRevealStage が親から 2つの custom property を減衰させる:
      //   --peek-blur (24px→0) でフロストを解き、--peek-opacity (1→0) でカード“自身”を
      //   まるごと(背景＋中身)フェードさせて奥だけを残す。opacity をこのカード自要素に
      //   かけるのが要点で、祖先 opacity だと backdrop-filter を持つ本要素の中身が WebKit で
      //   濃いまま残る癖を回避する(自要素 opacity は backdrop-filter 出力ごと確実に消える)。
      // ★小型端末(iPhone SE/mini 等・max-height:740px)ではカードの縦を詰めて、最下部の
      //   退避ピルが下部固定ナビの裏へ回り込まない高さに収める(--gate-num=巨大数字の縮小)。
      className="rounded-[32px] px-5 py-7 md:px-8 md:py-8 [--gate-num:clamp(84px,26vw,152px)] [@media(max-height:740px)]:py-4 [@media(max-height:740px)]:[--gate-num:clamp(52px,16vw,84px)] shadow-[0_28px_70px_-10px_rgba(46,46,92,0.34),0_6px_18px_rgba(46,46,92,0.12),inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-black/[0.06] [will-change:opacity]"
      style={{
        background: "rgba(255,255,255,0.9)",
        opacity: "var(--peek-opacity, 1)",
        backdropFilter: "blur(var(--peek-blur, 24px))",
        WebkitBackdropFilter: "blur(var(--peek-blur, 24px))",
      }}
    >
      {/* ===== 再訪リビール: 「◯人届いた！」バナー (deliveredCount>0 のときだけ高さを取る) ===== */}
      <div
        className={
          deliveredCount > 0 ? "mb-1 flex h-8 items-center justify-center" : "hidden"
        }
      >
        {deliveredCount > 0 && (
          <span
            key={bounceKey}
            className="animate-gate-slot-pop inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] md:text-[15px] font-black text-white"
            style={{ background: LAVENDER }}
          >
            <span aria-hidden="true">🎉</span>
            {isKo
              ? `${deliveredCount}명의 답변이 도착했어요!`
              : `${deliveredCount}人届いた！`}
          </span>
        )}
      </div>

      {/* スクリーンリーダー向けの進捗テキスト (見出し/数字/スロットは撤去済み・QRが主役) */}
      <p className="sr-only">
        {isKo
          ? `${remaining}명이 더 답하면 결과가 열려요.`
          : `あと${remaining}人の回答で結果が開きます。`}
      </p>

      {/* ===== QR招待: その場で友達に読み取ってもらい診断へ (対面ルート) ===== */}
      {qrInviteUrl && (
        <div className="mt-1 flex flex-col items-center">
          {/* キャッチコピー (QR タイルと同じ幅いっぱいに広げる) */}
          <p
            className="mb-3 w-full max-w-[300px] whitespace-nowrap text-center text-[24px] md:text-[25px] font-black leading-snug"
            style={{ color: NAVY }}
          >
            <span style={{ color: LAVENDER }}>
              {isKo ? "친구 진단" : "友達診断"}
            </span>
            {isKo ? "을 완성해요!" : "を完成させよう！"}
          </p>
          <div
            className="w-full max-w-[300px] rounded-2xl border bg-white p-4 shadow-[0_8px_24px_rgba(46,46,92,0.10)]"
            style={{ borderColor: STITCH }}
            role="img"
            aria-label={isKo ? "친구 진단 초대 QR 코드" : "友達診断への招待QRコード"}
          >
            <div className="relative">
              <QRCodeSVG
                value={withRef(qrInviteUrl, "qr")}
                size={260}
                className="h-auto w-full"
                bgColor="#FFFFFF"
                fgColor={NAVY}
                level="H"
                marginSize={0}
              />
              {/* 中央のキャラ顔 (丸抜き・白リング)。level="H" (30%欠損許容) に対し
                  約34%幅≈11%面積 (+白リング) の被覆。実機スキャンで読めることを確認して運用する。 */}
              {qrImageSrc && (
                <span className="absolute left-1/2 top-1/2 block w-[34%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-white ring-4 ring-white shadow-[0_2px_8px_rgba(46,46,92,0.18)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrImageSrc}
                    alt=""
                    className="block h-full w-full object-cover"
                  />
                </span>
              )}
            </div>
          </div>
          <p
            className="mt-2 text-center text-[12.5px] font-bold"
            style={{ color: READ_GRAY }}
          >
            {isKo
              ? "친구의 스마트폰으로 읽고 진단에 답해 달라고 부탁해요!"
              : "友達のスマホで読み取って、診断してもらおう！"}
          </p>
        </div>
      )}

      {/* ===== シェアボタン行: LINE(ko は KakaoTalk) / X / リンクコピー / その他でシェア。
          data-no-drag でドラッグ非開始。channel 別 ?ref で流入元を計測する。 ===== */}
      {qrInviteUrl && (
        <div
          ref={shareRowRef}
          className="mx-auto mt-6 [@media(max-height:740px)]:mt-4 flex w-full max-w-[300px] items-center gap-2"
          data-no-drag
        >
          {isKo ? (
            <button
              type="button"
              onClick={handleKakaoShare}
              aria-label="카카오톡으로 보내기"
              className={sharePill}
              style={{ background: "#FEE500", color: "#3C1E1E" }}
            >
              <KakaoTalkGlyph className="h-5 w-5" />
            </button>
          ) : (
            <a
              href={`https://line.me/R/msg/text/?${encodeURIComponent(
                `${shareText} ${withRef(qrInviteUrl, "line")}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => fireShare("line")}
              className={`${sharePill} bg-[#06C755]`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden="true">
                <path d="M12 3C6.477 3 2 6.69 2 11.246c0 4.082 3.547 7.503 8.34 8.146.325.07.767.215.879.494.1.252.066.647.032.901l-.142.852c-.043.252-.2.985.864.537 1.064-.448 5.735-3.376 7.823-5.78C20.98 14.94 22 13.21 22 11.246 22 6.69 17.523 3 12 3Z" />
              </svg>
              <span className="sr-only">LINEで送る</span>
            </a>
          )}
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
              shareText,
            )}&url=${encodeURIComponent(withRef(qrInviteUrl, "x"))}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => fireShare("x")}
            className={`${sharePill} bg-black`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden="true">
              <path d="M18.244 2H21.5l-7.5 8.59L23 22h-6.844l-5.357-7.012L4.66 22H1.4l8.04-9.196L1 2h6.998l4.84 6.4Zm-1.2 18h1.846L7.04 4H5.09l11.954 16Z" />
            </svg>
            <span className="sr-only">
              {isKo ? "X로 공유" : "Xで共有"}
            </span>
          </a>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={isKo ? "초대 링크 복사" : "招待リンクをコピー"}
            className={`${sharePill} bg-[#5B5BEF]`}
          >
            {copied ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5L20 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={handleNativeShare}
            aria-label={isKo ? "다른 방법으로 공유" : "その他の方法でシェア"}
            className={`${sharePill}`}
            style={{ background: NAVY }}
          >
            {/* iOS 標準の共有アイコン (箱 + 上矢印) */}
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 11v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9" />
              <path d="M16 6l-4-4-4 4" />
              <path d="M12 2v13" />
            </svg>
            <span className="sr-only">
              {isKo ? "다른 방법으로 공유" : "その他の方法でシェア"}
            </span>
          </button>
        </div>
      )}

      {/* ===== 退避トリガ: 押している間だけ手前カードを透過させ奥をチラ見。
          カード内に置くことで端末サイズ/下部ナビに隠れず常時タップ可能。
          押下ハンドラは器(TakoRevealStage)の rAF を PeekContext 経由で駆動する。
          touch-action:none で押下保持中のスクロール奪取を防ぐ。 ===== */}
      {peek && !peek.hidden && (
        <div className="mt-5 [@media(max-height:740px)]:mt-3 flex justify-center">
          <button
            type="button"
            aria-label={
              isKo
                ? "누르는 동안 뒤의 결과를 미리 볼 수 있어요"
                : "押している間、奥の結果をチラ見できます"
            }
            data-no-drag
            onPointerDown={peek.onPeekStart}
            onPointerUp={peek.onPeekEnd}
            onPointerCancel={peek.onPeekEnd}
            onPointerLeave={peek.onPeekEnd}
            className="inline-flex select-none items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-black ring-1 ring-black/[0.06] active:scale-95"
            style={{
              background: "rgba(240,241,248,0.95)",
              color: NAVY,
              touchAction: "none",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {isKo ? "눌러서 결과 살짝 보기" : "押して奥をチラ見"}
          </button>
        </div>
      )}
    </div>
  );
}
