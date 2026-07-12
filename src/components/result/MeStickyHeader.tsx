"use client";

// /me (自己診断結果) 専用のヘッダー + アンロックバー (16P 参考、2026-07-13 指示)。
//
// 挙動:
//   - ヘッダー部分は従来の ScrollHideHeader と同じ (下スクロールで隠れ、上で出る)
//   - その直下のバー (QR/X/LINE + すべての結果のロックを解除) は「常時表示」。
//     ヘッダーが隠れるときはヘッダーの高さぶんだけ全体を持ち上げ、バーが最上部に残る。
// ScrollHideHeader は children ごと -100% 平行移動するためバーも消えてしまう。
// ここではヘッダー実高を測り、隠すときは -headerHeight だけ動かす (バーは残る)。
//
// バーの左側 3 ボタン (QR/X/LINE) は友達招待のシェア (16P の丸アイコン群参考)。
// シェア文言は ResultActions と同一トーン。QR はポップオーバーで表示。

import { useEffect, useRef, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { scrollToPaywall } from "@/lib/scroll-to-paywall";

interface MeStickyHeaderProps {
  /** ヘッダー本体 (TopHeader)。 */
  children: ReactNode;
  /** バーを出すか (第二部が未解放のときのみ true)。false なら従来ヘッダーと同じ。 */
  showUnlockBar: boolean;
  /** 友達招待 URL (/friend/[inviteCode])。シェア3ボタンで使用。 */
  inviteUrl?: string;
  /** シェア文言用の称号 (essence)。 */
  essence?: string;
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
  showUnlockBar,
  inviteUrl,
  essence,
}: MeStickyHeaderProps) {
  const [hidden, setHidden] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
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

  // シェア文言は ResultActions と同一トーン (招待 = 評価してもらう導線)。
  const shareText = `私のトリセツは「${essence ?? ""}」でした！\nあなたから見た私はどう見えてる？10問だけ、こっそり教えて👀`;
  const xUrl = inviteUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(inviteUrl)}`
    : undefined;
  const lineUrl = inviteUrl
    ? `https://line.me/R/msg/text/?${encodeURIComponent(`${shareText}\n${inviteUrl}`)}`
    : undefined;

  return (
    <div className="sticky top-0 z-50">
      <div
        className="transition-transform duration-300"
        style={{
          transform:
            hidden && showUnlockBar
              ? `translateY(-${headerH}px)`
              : hidden
                ? "translateY(-100%)"
                : "translateY(0)",
        }}
      >
        <div ref={headerRef}>{children}</div>

        {showUnlockBar && (
          <div className="relative flex items-center justify-end gap-2 border-b border-[#E9E9F2] bg-white px-4 py-2 md:px-8">
            {/* シェア3ボタン (QR / X / LINE)。招待 URL があるときのみ */}
            {inviteUrl && (
              <>
                <CircleIconButton
                  label="QRコードを表示"
                  onClick={() => setQrOpen((v) => !v)}
                >
                  {/* QR アイコン */}
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
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 14h3v3h-3zM20 14h1M14 20h1M20 20h1" />
                  </svg>
                </CircleIconButton>
                <CircleIconButton label="Xでシェア" href={xUrl}>
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
                <CircleIconButton label="LINEでシェア" href={lineUrl}>
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

                {/* QR ポップオーバー (バー直下・右寄せ) */}
                {qrOpen && (
                  <div className="absolute right-4 top-full z-50 mt-2 rounded-2xl border border-[#E3E6F5] bg-white p-4 shadow-[0_12px_36px_rgba(46,46,92,0.20)] md:right-8">
                    <QRCodeSVG value={inviteUrl} size={140} fgColor="#2E2E5C" />
                    <p className="mt-2 text-center text-[11px] font-bold text-[#2E2E5C]/60">
                      友達のスマホで読み取ってもらおう
                    </p>
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              onClick={scrollToPaywall}
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
              すべての結果のロックを解除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
