"use client";

// /me (自己診断結果) 専用のヘッダー + アンロックバー (16P 参考、2026-07-13 指示)。
//
// 挙動:
//   - ヘッダー部分は従来の ScrollHideHeader と同じ (下スクロールで隠れ、上で出る)
//   - その直下のバー (シェア + すべての結果のロックを解除) は「常時表示」。
//     ヘッダーが隠れるときはヘッダーの高さぶんだけ全体を持ち上げ、バーが最上部に残る。
//   - 解放後もバー自体 (シェアボタン) は出し続ける (2026-07-15 指示)。
//     解除 CTA ボタンだけ未解放時限定 (showUnlockCta)。
// ScrollHideHeader は children ごと -100% 平行移動するためバーも消えてしまう。
// ここではヘッダー実高を測り、隠すときは -headerHeight だけ動かす (バーは残る)。
//
// シェアは大きめの丸ボタン1個に集約 (2026-07-26 指示、16P のシェアアイコン参考)。
// 押すとモーダル (結果をシェアしよう: LINE / X / リンクコピー) を開く。
// モーダルは createPortal で body 直下に出す。ヘッダーは隠れるとき transform を
// 持つため、この中で fixed を使うと基準がヘッダーになり画面全体を覆えない。

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { scrollToPaywall } from "@/lib/scroll-to-paywall";
import { track } from "@/lib/track";
import { withRef } from "@/lib/acquisition-link";
import { SHARE_OPEN_EVENT } from "@/components/result/ShareModalOpenButton";
import type { ResultLocale } from "@/i18n/result";

interface MeStickyHeaderProps {
  /** ヘッダー本体 (TopHeader)。 */
  children: ReactNode;
  /** 「すべての結果のロックを解除」CTA を出すか (第二部が未解放のときのみ true)。
      false でもシェアボタンのバー自体は shareUrl があれば表示する。 */
  showUnlockCta: boolean;
  /** 共有 URL。character=/share/[inviteCode]、invite=/friend/[inviteCode]。 */
  shareUrl?: string;
  /**
   * シェアボタンの種別 (2026-07-28)。
   *   - "character" (既定): 自分の結果 (キャラ) をシェアする従来モード (/me)。
   *   - "invite": 友達にもっと診断してもらう招待モード (/tako)。文言・計測を
   *     LockedInviteShare (招待パネル) と揃え、friend_invite_clicked を発火する。
   */
  shareKind?: "character" | "invite";
  /** invite モードの計測用 (friend_invite_clicked に載せる)。 */
  ownerToken?: string;
  inviteCode?: string;
  /** シェア文言用の称号 (essence)。character モードのみ使用。 */
  essence?: string;
  /** シェア文言用の Big Five コード (ヒーローと同じ大小方式。例 "OCeAN")。 */
  code?: string;
  /** 解除CTAのスクロール先 id。省略時は /me の #fullaccess-promo (/tako は "tako-promo")。 */
  paywallTargetId?: string;
  /**
   * 完全版レポート生成ボタンの href (/tako の購入者向け・2026-07-21)。
   * 指定時はバー右端に「完全版レポートを生成」を表示 (解除CTAとは排他運用を想定)。
   */
  reportHref?: string;
  /**
   * 獲得ランディング (/share) 用: バー右端に「無料で性格診断をする」を表示 (2026-07-26)。
   * 課金CTA (showUnlockCta) / シェアボタンとは排他運用を想定。
   */
  diagnosisCta?: boolean;
  locale?: ResultLocale;
}

// iOS 風のシェアグリフ (トレイ + 上矢印。16P のシェアボタン参考)。
function ShareGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

export function MeStickyHeader({
  children,
  showUnlockCta,
  shareUrl,
  shareKind = "character",
  ownerToken,
  inviteCode,
  essence,
  code,
  paywallTargetId,
  reportHref,
  diagnosisCta,
  locale = "ja",
}: MeStickyHeaderProps) {
  // バー自体は CTA (未解放) か シェアボタン (shareUrl) のどちらかがあれば出す。
  const showBar =
    showUnlockCta ||
    Boolean(shareUrl) ||
    Boolean(reportHref) ||
    Boolean(diagnosisCta);
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // モーダルを開いた設置場所 (share_clicked の metadata.source)。
  // ヘッダーのボタン=sticky_bar / 本文中の ShareModalOpenButton=イベントの detail.source。
  const [shareSource, setShareSource] = useState("sticky_bar");
  const lastY = useRef(0);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    // ヘッダー実高を測る (リサイズにも追従)
    const measure = () => setHeaderH(headerRef.current?.offsetHeight ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 40) {
        setHidden(false);
      } else {
        const delta = y - lastY.current;
        if (delta > 4) setHidden(true);
        else if (delta < -4) setHidden(false);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 本文中の「シェア」ピル (ShareModalOpenButton) からの開く要求を拾う。
  // shareUrl の無いページ (獲得ランディング等) では無視する。
  useEffect(() => {
    if (!shareUrl) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ source?: unknown }>).detail;
      setShareSource(
        typeof detail?.source === "string" ? detail.source : "sticky_bar",
      );
      setShareOpen(true);
    };
    window.addEventListener(SHARE_OPEN_EVENT, handler);
    return () => window.removeEventListener(SHARE_OPEN_EVENT, handler);
  }, [shareUrl]);

  // モーダルは Escape でも閉じられるように。
  useEffect(() => {
    if (!shareOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShareOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shareOpen]);

  const isInvite = shareKind === "invite";

  // キャラクター共有文言。称号 + Big Five コード (例: 寄添者（OCeAN）) を差し込む。
  // 友達診断への回答依頼は含めず、純粋なキャラ共有として扱う。
  // invite モード (/tako) は LockedInviteShare と同じ招待文言に切り替える。
  const title = code ? `${essence ?? ""}（${code}）` : (essence ?? "");
  const shareText = isInvite
    ? "友達から見たわたしを教えて！「ワタシのトリセツ」で友達診断テストができるよ"
    : locale === "ko"
      ? `나의 사용설명서는 ‘${title}’ 유형이었어요!\n내 캐릭터를 확인해 보세요👇`
      : `ワタシのトリセツは「${title}」でした！\n私のキャラクターを見てみて👇`;
  const xUrl = shareUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(withRef(shareUrl, "x"))}`
    : undefined;
  const lineUrl = shareUrl
    ? `https://line.me/R/msg/text/?${encodeURIComponent(`${shareText}\n${withRef(shareUrl, "line")}`)}`
    : undefined;
  // Facebook は sharer.php (テキストは付与不可・URL のみ)。
  const fbUrl = shareUrl
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(withRef(shareUrl, "facebook"))}`
    : undefined;

  // 「その他」= OS のシェアシート (Web Share API)。Instagram 等の個別対応が
  // 不要になる。非対応環境 (主に PC ブラウザ) ではボタン自体を出さない。
  // navigator は SSR に無いため effect で判定する。
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  // invite モードは招待ファネルの friend_invite_clicked (LockedInviteShare と同じ
  // イベント・source だけ設置場所で分ける)。character は従来の share_clicked。
  const fireShare = (channel: "copy" | "x" | "line" | "facebook" | "native") =>
    isInvite
      ? track("friend_invite_clicked", {
          ownerToken,
          inviteCode,
          metadata: { channel, source: "tako_sticky_bar" },
        })
      : track("share_clicked", {
          metadata: { channel, kind: "character", source: shareSource },
        });

  const handleNativeShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.share({
        text: shareText,
        url: withRef(shareUrl, "native"),
      });
      // 共有先を選んで完了した時のみ計測 (キャンセルは reject され catch へ)。
      fireShare("native");
    } catch {
      // キャンセル/非対応は無視
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    // コピーは文章を付けずリンクだけ (2026-07-28 指示。invite/character 共通形式。
    // 共有文 shareText は LINE/X/その他 のシェアインテント側でのみ使う)。
    const value = withRef(shareUrl, "copy");
    let succeeded = false;
    try {
      await navigator.clipboard.writeText(value);
      succeeded = true;
    } catch {
      // アプリ内ブラウザなど Clipboard API が使えない環境向けのフォールバック。
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      try {
        textarea.select();
        succeeded = document.execCommand("copy");
      } finally {
        textarea.remove();
      }
    }
    if (!succeeded) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    fireShare("copy");
  };

  const isKo = locale === "ko";

  return (
    <div className="sticky top-0 z-50">
      <div
        className="transition-transform duration-300"
        // 表示中は transform を持たせない (undefined)。translateY(0) でも transform が
        // あると子孫の fixed 要素 (TopHeader のドロワー等) の基準がこの div になり、
        // メニューがヘッダー内に閉じ込められて崩れる (ScrollHideHeader と同じ対策)。
        style={{
          transform: hidden
            ? showBar
              ? `translateY(-${headerH}px)`
              : "translateY(-100%)"
            : undefined,
        }}
      >
        <div ref={headerRef}>{children}</div>

        {showBar && (
          <div className="relative flex items-center justify-end gap-2 border-b border-[#E9E9F2] bg-white px-4 py-2 md:px-8">
            {/* シェアボタン (1個に集約・大きめ)。キャラクター共有 URL があるときのみ */}
            {shareUrl && (
              <button
                type="button"
                aria-label={
                  isInvite
                    ? "友達に診断してもらう"
                    : isKo
                      ? "결과 공유"
                      : "結果をシェア"
                }
                aria-haspopup="dialog"
                onClick={() => {
                  setShareSource("sticky_bar");
                  setShareOpen(true);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#5B5BEF]/35 bg-white text-[#5B5BEF] transition-colors hover:bg-[#F4F4FE]"
              >
                <ShareGlyph size={20} />
              </button>
            )}

            {reportHref && (
              <a
                href={reportHref}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#5B5BEF] px-4 py-2 text-[12px] font-black text-white shadow-[0_3px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_1px_0_#3d3dc4] md:text-[13px]"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                  <path d="M14 2v5h5" />
                  <path d="M12 18v-6" />
                  <path d="m9 15 3 3 3-3" />
                </svg>
                完全版レポートを生成
              </a>
            )}

            {diagnosisCta && (
              <a
                href="/diagnosis"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#5B5BEF] px-4 py-2 text-[12px] font-black text-white shadow-[0_3px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_1px_0_#3d3dc4] md:text-[13px]"
              >
                無料で性格診断をする
              </a>
            )}

            {showUnlockCta && (
              <button
                type="button"
                onClick={() => scrollToPaywall("sticky_bar", paywallTargetId)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#5B5BEF] px-4 py-2 text-[12px] font-black text-white shadow-[0_3px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_1px_0_#3d3dc4] md:text-[13px]"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="4" y="10" width="16" height="11" rx="2.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                {isKo ? "모든 결과 잠금 해제" : "すべての結果のロックを解除"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ===== シェアモーダル (16P の「結果を共有しましょう」参考) =====
          body 直下へポータル (ヘッダーの transform に fixed が閉じ込められるのを回避)。 */}
      {shareOpen &&
        shareUrl &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              isInvite
                ? "友達に診断してもらおう"
                : isKo
                  ? "결과를 공유해요"
                  : "結果をシェアしよう"
            }
            className="fixed inset-0 z-[80] flex items-center justify-center px-6"
          >
            {/* 背景 (クリックで閉じる) */}
            <button
              type="button"
              aria-label={isKo ? "닫기" : "閉じる"}
              onClick={() => setShareOpen(false)}
              className="absolute inset-0 cursor-default bg-[#2E2E5C]/45"
            />
            <div className="relative w-full max-w-[360px] rounded-2xl bg-white px-6 pb-7 pt-6 shadow-[0_18px_50px_rgba(46,46,92,0.3)]">
              {/* 閉じる × */}
              <button
                type="button"
                aria-label={isKo ? "닫기" : "閉じる"}
                onClick={() => setShareOpen(false)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[#2E2E5C]/45 transition-colors hover:bg-[#F4F4FE] hover:text-[#2E2E5C]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>

              <p className="mb-5 text-[18px] font-black text-[#2E2E5C]">
                {isInvite
                  ? "友達に診断してもらおう"
                  : isKo
                    ? "결과를 공유해요"
                    : "結果をシェアしよう"}
              </p>
              {isInvite && (
                <p className="-mt-3 mb-5 text-[12.5px] font-bold leading-[1.7] text-[#8A8AA3]">
                  答えてくれた友達のぶんだけ、結果シートが増えていくよ
                </p>
              )}

              {/* SNS ボタン (丸アイコン + ラベル。16P の Facebook/X 行の体裁) */}
              <div className="mb-6 flex items-start gap-6">
                <a
                  href={lineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => fireShare("line")}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#06C755] text-white transition-transform hover:scale-105">
                    {/* LINE 吹き出し */}
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.5 7.4 8.3 8-.1.4-.5 1.8-.6 2.1 0 0-.1.4.2.6.3.2.6 0 .6 0 .8-.5 4.4-2.9 5.9-4.2 3.3-1.2 5.6-3.7 5.6-6.5C22 6.6 17.5 3 12 3z" />
                    </svg>
                  </span>
                  <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                    LINE
                  </span>
                </a>
                <a
                  href={xUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => fireShare("x")}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white transition-transform hover:scale-105">
                    {/* X ロゴ */}
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
                    </svg>
                  </span>
                  <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                    X
                  </span>
                </a>
                <a
                  href={fbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => fireShare("facebook")}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1877F2] text-white transition-transform hover:scale-105">
                    {/* Facebook "f" */}
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M13.5 21v-7h2.4l.45-3H13.5V9.1c0-.87.28-1.6 1.66-1.6h1.34V4.85c-.3-.04-1.3-.13-2.44-.13-2.4 0-4.06 1.47-4.06 4.17V11H7.6v3h2.4v7h3.5z" />
                    </svg>
                  </span>
                  <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                    Facebook
                  </span>
                </a>
                {/* その他 = OS のシェアシート (対応端末のみ。Instagram 等はこちらから) */}
                {canNativeShare && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDEEFC] text-[#5B5BEF] transition-transform hover:scale-105">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <circle cx="5" cy="12" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="19" cy="12" r="2" />
                      </svg>
                    </span>
                    <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                      その他
                    </span>
                  </button>
                )}
              </div>

              {/* リンクコピー (URL 表示 + コピー。コピー内容は共有文つき) */}
              <p className="mb-1.5 text-[12px] font-bold text-[#2E2E5C]/60">
                {isInvite
                  ? "招待リンク"
                  : isKo
                    ? "캐릭터 링크"
                    : "キャラクターのリンク"}
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-[#E3E6F5] bg-[#FAFAFF] px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#2E2E5C]/80">
                  {shareUrl}
                </span>
                <button
                  type="button"
                  aria-label={
                    copied
                      ? isKo ? "복사했어요" : "コピーしました"
                      : isInvite
                        ? "招待リンクをコピー"
                        : isKo ? "캐릭터 링크 복사" : "キャラクターのリンクをコピー"
                  }
                  onClick={handleCopy}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#5B5BEF]/30 bg-white text-[#5B5BEF] transition-colors hover:bg-[#F4F4FE]"
                >
                  {copied ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12l4 4L19 6" />
                    </svg>
                  ) : (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="9" y="9" width="12" height="12" rx="2.5" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <span className="sr-only" role="status" aria-live="polite">
                {copied
                  ? isInvite
                    ? "招待リンクをコピーしました"
                    : isKo
                      ? "캐릭터 링크를 복사했어요"
                      : "キャラクターのリンクをコピーしました"
                  : ""}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
