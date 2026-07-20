"use client";

// /me (自己診断結果) 専用のヘッダー + アンロックバー (16P 参考、2026-07-13 指示)。
//
// 挙動:
//   - ヘッダー部分は従来の ScrollHideHeader と同じ (下スクロールで隠れ、上で出る)
//   - その直下のバー (コピー/X/LINE + すべての結果のロックを解除) は「常時表示」。
//     ヘッダーが隠れるときはヘッダーの高さぶんだけ全体を持ち上げ、バーが最上部に残る。
//   - 解放後もバー自体 (シェア3ボタン) は出し続ける (2026-07-15 指示)。
//     解除 CTA ボタンだけ未解放時限定 (showUnlockCta)。
// ScrollHideHeader は children ごと -100% 平行移動するためバーも消えてしまう。
// ここではヘッダー実高を測り、隠すときは -headerHeight だけ動かす (バーは残る)。
//
// バーの左側 3 ボタン (コピー/X/LINE) はキャラクター結果のシェア
// (16P の丸アイコン群参考)。友達診断への招待とは分離する。

import { useEffect, useRef, useState, type ReactNode } from "react";
import { scrollToPaywall } from "@/lib/scroll-to-paywall";
import { track } from "@/lib/track";
import { withRef } from "@/lib/acquisition-link";
import type { ResultLocale } from "@/i18n/result";

interface MeStickyHeaderProps {
  /** ヘッダー本体 (TopHeader)。 */
  children: ReactNode;
  /** 「すべての結果のロックを解除」CTA を出すか (第二部が未解放のときのみ true)。
      false でもシェア3ボタンのバー自体は shareUrl があれば表示する。 */
  showUnlockCta: boolean;
  /** キャラクター共有 URL (/share/[inviteCode])。シェア3ボタンで使用。 */
  shareUrl?: string;
  /** シェア文言用の称号 (essence)。 */
  essence?: string;
  /** シェア文言用の Big Five コード (ヒーローと同じ大小方式。例 "OCeAN")。 */
  code?: string;
  /** 解除CTAのスクロール先 id。省略時は /me の #fullaccess-promo (/tako は "tako-promo")。 */
  paywallTargetId?: string;
  locale?: ResultLocale;
}

// 丸アイコンボタン (16P のバー左側参考)。
function CircleIconButton({
  label,
  onClick,
  href,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  const cls =
    "flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#5B5BEF]/35 bg-white text-[#5B5BEF] transition-colors hover:bg-[#F4F4FE]";
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        onClick={onClick}
        className={cls}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function MeStickyHeader({
  children,
  showUnlockCta,
  shareUrl,
  essence,
  code,
  paywallTargetId,
  locale = "ja",
}: MeStickyHeaderProps) {
  // バー自体は CTA (未解放) か シェアボタン (shareUrl) のどちらかがあれば出す。
  const showBar = showUnlockCta || Boolean(shareUrl);
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);
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

  // キャラクター共有文言。称号 + Big Five コード (例: 寄添者（OCeAN）) を差し込む。
  // 友達診断への回答依頼は含めず、純粋なキャラ共有として扱う。
  const title = code ? `${essence ?? ""}（${code}）` : (essence ?? "");
  const shareText = locale === "ko"
    ? `나의 사용설명서는 ‘${title}’ 유형이었어요!\n내 캐릭터를 확인해 보세요👇`
    : `ワタシのトリセツは「${title}」でした！\n私のキャラクターを見てみて👇`;
  const xUrl = shareUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(withRef(shareUrl, "x"))}`
    : undefined;
  const lineUrl = shareUrl
    ? `https://line.me/R/msg/text/?${encodeURIComponent(`${shareText}\n${withRef(shareUrl, "line")}`)}`
    : undefined;

  const fireShare = (channel: "copy" | "x" | "line") =>
    track("share_clicked", {
      metadata: { channel, kind: "character", source: "sticky_bar" },
    });

  const handleCopy = async () => {
    if (!shareUrl) return;
    const value = `${shareText}\n${withRef(shareUrl, "copy")}`;
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

  return (
    <div className="sticky top-0 z-50">
      <div
        className="transition-transform duration-300"
        style={{
          transform:
            hidden && showBar
              ? `translateY(-${headerH}px)`
              : hidden
                ? "translateY(-100%)"
                : "translateY(0)",
        }}
      >
        <div ref={headerRef}>{children}</div>

        {showBar && (
          <div className="relative flex items-center justify-end gap-2 border-b border-[#E9E9F2] bg-white px-4 py-2 md:px-8">
            {/* シェア3ボタン (コピー / X / LINE)。キャラクター共有 URL があるときのみ */}
            {shareUrl && (
              <>
                <CircleIconButton
                  label={
                    copied
                      ? locale === "ko" ? "복사했어요" : "コピーしました"
                      : locale === "ko" ? "캐릭터 공유 문구와 링크 복사" : "キャラクターの共有文とリンクをコピー"
                  }
                  onClick={handleCopy}
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
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  )}
                </CircleIconButton>
                <span className="sr-only" role="status" aria-live="polite">
                  {copied
                    ? locale === "ko"
                      ? "캐릭터 공유 문구와 링크를 복사했어요"
                      : "キャラクターの共有文とリンクをコピーしました"
                    : ""}
                </span>
                <CircleIconButton
                  label={locale === "ko" ? "X에 공유" : "Xでシェア"}
                  href={xUrl}
                  onClick={() => fireShare("x")}
                >
                  {/* X ロゴ */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
                  </svg>
                </CircleIconButton>
                <CircleIconButton
                  label={locale === "ko" ? "LINE에 공유" : "LINEでシェア"}
                  href={lineUrl}
                  onClick={() => fireShare("line")}
                >
                  {/* LINE 吹き出し */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.5 7.4 8.3 8-.1.4-.5 1.8-.6 2.1 0 0-.1.4.2.6.3.2.6 0 .6 0 .8-.5 4.4-2.9 5.9-4.2 3.3-1.2 5.6-3.7 5.6-6.5C22 6.6 17.5 3 12 3z" />
                  </svg>
                </CircleIconButton>
              </>
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
                {locale === "ko" ? "모든 결과 잠금 해제" : "すべての結果のロックを解除"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
