"use client";

// /me (自己診断結果) 専用のヘッダー + アンロックバー (16P 参考、2026-07-13 指示)。
//
// 挙動:
//   - ヘッダー部分は従来の ScrollHideHeader と同じ (下スクロールで隠れ、上で出る)
//   - その直下のバー (QR/X/LINE + すべての結果のロックを解除) は「常時表示」。
//     ヘッダーが隠れるときはヘッダーの高さぶんだけ全体を持ち上げ、バーが最上部に残る。
//   - 解放後もバー自体 (シェア3ボタン) は出し続ける (2026-07-15 指示)。
//     解除 CTA ボタンだけ未解放時限定 (showUnlockCta)。
// ScrollHideHeader は children ごと -100% 平行移動するためバーも消えてしまう。
// ここではヘッダー実高を測り、隠すときは -headerHeight だけ動かす (バーは残る)。
//
// バーの左側 3 ボタン (QR/X/LINE) は友達招待のシェア (16P の丸アイコン群参考)。
// シェア文言は ResultActions と同一トーン。QR はポップオーバーで表示。

import { useEffect, useRef, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { scrollToPaywall } from "@/lib/scroll-to-paywall";
import { track } from "@/lib/track";

interface MeStickyHeaderProps {
  /** ヘッダー本体 (TopHeader)。 */
  children: ReactNode;
  /** 「すべての結果のロックを解除」CTA を出すか (第二部が未解放のときのみ true)。
      false でもシェア3ボタンのバー自体は inviteUrl があれば表示する。 */
  showUnlockCta: boolean;
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
  inviteUrl,
  essence,
}: MeStickyHeaderProps) {
  // バー自体は CTA (未解放) か シェアボタン (inviteUrl) のどちらかがあれば出す。
  const showBar = showUnlockCta || Boolean(inviteUrl);
  const [hidden, setHidden] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const lastY = useRef(0);
  const headerRef = useRef<HTMLDivElement>(null);
  const qrAreaRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(0);

  // QR 吹き出しの外側クリックで閉じる。
  // ※ 祖先に transform があるため fixed オーバーレイは使えない (containing block が
  //   transform 要素になり全画面を覆えない)。document リスナーで判定する。
  useEffect(() => {
    if (!qrOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!qrAreaRef.current?.contains(e.target as Node)) setQrOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [qrOpen]);

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
            {/* シェア3ボタン (QR / X / LINE)。招待 URL があるときのみ */}
            {inviteUrl && (
              <>
                {/* QR ボタン + 吹き出し (ボタン基準で直下に、矢印付き) */}
                <div className="relative" ref={qrAreaRef}>
                  <CircleIconButton
                    label="QRコードを表示"
                    onClick={() => {
                      // 開くときだけ招待クリックとして計測 (KPI: friend_invite_clicked)
                      if (!qrOpen)
                        track("friend_invite_clicked", {
                          metadata: { channel: "qr", source: "sticky_bar" },
                        });
                      setQrOpen((v) => !v);
                    }}
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

                  {qrOpen && (
                    <>
                      {/* 吹き出し本体: ボタンの左端基準で少し左に出し、右へ広げる
                          (SP で画面左に見切れない)。矢印はボタン中央 (left 38px) を指す。 */}
                      <div className="absolute -left-[20px] top-full z-50 mt-3 w-[188px] rounded-2xl border border-[#E3E6F5] bg-white p-4 shadow-[0_12px_36px_rgba(46,46,92,0.20)]">
                        {/* 矢印 (ボタンの真下を指す) */}
                        <span
                          aria-hidden="true"
                          className="absolute -top-[7px] left-[38px] h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-l border-t border-[#E3E6F5] bg-white"
                        />
                        <div className="flex flex-col items-center">
                          <QRCodeSVG value={inviteUrl} size={148} fgColor="#2E2E5C" />
                          <p className="mt-2.5 text-center text-[11px] font-bold leading-snug text-[#2E2E5C]/60">
                            友達のスマホで
                            <br />
                            読み取ってもらおう
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <CircleIconButton
                  label="Xでシェア"
                  href={xUrl}
                  onClick={() =>
                    track("friend_invite_clicked", {
                      metadata: { channel: "x", source: "sticky_bar" },
                    })
                  }
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
                  label="LINEでシェア"
                  href={lineUrl}
                  onClick={() =>
                    track("friend_invite_clicked", {
                      metadata: { channel: "line", source: "sticky_bar" },
                    })
                  }
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
              onClick={() => scrollToPaywall("sticky_bar")}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
