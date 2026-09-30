"use client";

import { TakoLockPopover } from "@/components/TakoLockPopover";
import { useUiCopy, useUiText } from "@/i18n/ui/use-ui-copy";
import type { SiteLocale } from "@/lib/locale-switch";
import { useAishoNavigationAccess } from "@/lib/use-aisho-navigation-access";
import { useCourseNavigationAccess } from "@/lib/use-course-navigation-access";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// feat/top-page: トップページのフッター (16Personalities 型のマルチカラム)。
// 配色は Sora (navy #2E2E5C 見出し / blue #5B5BEF アクセント)、フォントは Noto Sans JP。
// リンクは実在ルートのみ。SNS アイコンは ⚠️ プレースホルダ (href を実 URL に差し替え)。
// 友達診断テストの遷移先解決 (localStorage) のためクライアントコンポーネント。
//
// 2026-08-15: 日本語版と韓国語版 (旧 KoTopFooter) を locale prop で統合。
// 文言・リンク先だけ CONTENT で分岐し、挙動・DOM は完全共通にする。

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

// external: Next の Link を使わない生 <a> (mailto / 外部サイト)。
// newTab: 外部サイトは別タブで開く (target="_blank" + rel="noopener noreferrer")。
// disabled: 準備中 (グレー表示・リンクなし)。ページが公開できたら外す。
// tako: 友達診断テスト。href は実行時に上書き (BottomNav/TopHeader と同じ /tako/[token] 解決)。
// children: 親リンクの下に小さく入れ子表示するサブリンク (内部リンク用)。



type TopLocale = SiteLocale | "en" | "id";

// SNS 公式アカウント。href が "#" (未開設) のものは描画時に除外される。
// 開設したら href を実 URL に差し替えるだけで表示される。
// label は aria-label のみに使うため locale 別 (X は日本語版のみ旧称を併記)。
const SOCIALS: {
  label: Record<TopLocale, string>;
  href: string;
  icon: React.ReactNode;
  badgeLabel?: Record<TopLocale, string>;
}[] = [
  {
    label: { ja: "Instagram", ko: "Instagram", en: "Instagram", id: "Instagram" },
    href: "https://www.instagram.com/torisetsu_app",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: { ja: "X (旧Twitter)", ko: "X", en: "X", id: "X" },
    href: "https://x.com/torisetsu_app",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
      </svg>
    ),
  },
  {
    label: { ja: "TikTok", ko: "TikTok", en: "TikTok", id: "TikTok" },
    href: "https://www.tiktok.com/@torisetsu_app",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
];

// topBorder: 本文との境目のうっすら区切り線 (2026-07-26 指示)。/diagnosis のように
// 直上がシェアバンドの波エッジで既に区切れているページでは false で消す。
export default function TopFooter({
  topBorder = true,
  locale = "ja",
}: {
  topBorder?: boolean;
  locale?: TopLocale;
}) {
  const uiText = useUiText(locale, "top.TopFooter");
  const isKo = locale === "ko";
  const isEn = locale === "en";
  const isId = locale === "id";
  const content = useUiCopy(locale).footer;
  const pathname = usePathname() ?? (isKo ? "/ko" : isEn ? "/en" : isId ? "/id" : "/");

  // 友達診断テストの遷移先を BottomNav/TopHeader と同じルールで解決:
  //   localStorage の owner_token があれば /tako/[token]、無ければロック表示
  //   (遷移せず TakoLockPopover。ヘッダー/ボトムナビと同じ挙動)。
  const [takoUrl, setTakoUrl] = useState(content.takoBaseHref);
  // 初期値 true (=ロックなし): 診断済みユーザーに一瞬ロックが見えるのを避ける
  // (BottomNav/TopHeader と同じ判断)。
  const [hasToken, setHasToken] = useState(true);
  const [takoLockOpen, setTakoLockOpen] = useState(false);
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const [accessCheckEnabled, setAccessCheckEnabled] = useState(false);

  // フッターが画面に近づいたときだけ相性診断の表示権限を確認する。
  // Headerと同じin-flight Promiseを共有するため、両方が必要になっても通信は1回。
  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    if (!("IntersectionObserver" in window)) {
      const timeout = setTimeout(() => {
        setAccessCheckEnabled(true);
      }, 0);
      return () => clearTimeout(timeout);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setAccessCheckEnabled(true);
        observer.disconnect();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const hasAishoNavigationAccess = useAishoNavigationAccess(
    pathname,
    accessCheckEnabled,
  );
  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // localStorage 不可環境: フォールバックのまま。
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTakoUrl(
      token
        ? `${content.takoBaseHref}/${encodeURIComponent(token)}`
        : content.takoBaseHref,
    );
    setHasToken(Boolean(token));
    setOwnerToken(token);
  }, [pathname, content.takoBaseHref]);

  // Alice・運命・タロットは購入権限が確定するまでロック表示に倒す。
  // BottomNav と同じリクエストを共有し、購入済みの場合だけ通常リンクへ戻す。
  const resolvedCourseAccess = useCourseNavigationAccess(ownerToken);

  const columns = content.columns.map((col) => ({
    ...col,
    links: col.links
      .filter(
        (link) =>
          !link.href.includes("/aisho") || hasAishoNavigationAccess,
      )
      .map((l) => (l.tako ? { ...l, href: takoUrl } : l)),
  }));

  // MBTI(16Personalities) 風: リンクは色つき(ミュートした Sora ブルー)。
  const linkClass =
    "text-[18px] text-[#6E72C8] transition-colors hover:text-[#5B5BEF] w-fit";
  // フッターはリンク数が多いため、表示されたリンク先を一括で先読みしない。
  // クリック時のNext Link遷移は維持する。
  const navigationPrefetch = false;

  // 日本語はページ側でフォントが確定しないため FONT_STACK を明示。
  // 韓国語は ko レイアウトのフォント設定をそのまま継承する。
  const fontStyle = isKo ? undefined : { fontFamily: FONT_STACK };

  return (
    <footer
      ref={footerRef}
      className={`w-full bg-white px-8 py-20 ${
        topBorder ? "border-t border-[#E9E9F2]" : ""
      }`}
      style={fontStyle}
    >
      {/* MBTI 風: 中央寄せのコンテナ(左右に余白) + エアリーな間隔。
          幅は自己診断結果 (/me) と同じ max-w-[1080px] に統一する。 */}
      <div className="mx-auto max-w-[1080px]">
        {/* リンク列 */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-3">
          {columns.map((col) => (
            <nav key={col.title} className="flex flex-col gap-4">
              <p className="mb-1 text-[18px] font-bold text-[#2E2E5C]">
                {col.title}
              </p>
              {col.links.map((l) => {
                const courseLocked = Boolean(
                  l.course && !(resolvedCourseAccess?.[l.course] ?? false),
                );

                return l.disabled ? (
                  <span
                    key={l.label}
                    className="w-fit text-[18px] text-[#B4B4C4]"
                    aria-disabled="true"
                  >
                    {l.label}
                    <span className="text-[12px]">{content.preparing}</span>
                  </span>
                ) : l.tako && !hasToken ? (
                  // 未診断時はロック表示: 遷移せずポップオーバーで解放条件を伝える
                  // (TopHeader/BottomNav と同じ挙動。色もロック中タブと同じグレー)。
                  <button
                    key={l.label}
                    type="button"
                    onClick={() => setTakoLockOpen(true)}
                    // 南京錠だけが折り返して孤立しないよう常に1行 (はみ出す数pxは
                    // カラム間の gap-x-10 に逃がす。グリッドは overflow を切らない)。
                    className="flex w-fit items-center gap-1 whitespace-nowrap text-left text-[18px]"
                    style={{ color: "#9BA3B4" }}
                  >
                    {l.label}
                    <MenuLockIcon />
                  </button>
                ) : courseLocked ? (
                  <Link
                    key={l.label}
                    href={l.href}
                    prefetch={navigationPrefetch}
                    aria-label={`${l.label}${
                      uiText("（ロック中）")
                    }`}
                    className="flex w-fit items-center gap-1 whitespace-nowrap text-left text-[18px]"
                    style={{ color: "#9BA3B4" }}
                  >
                    {l.label}
                    <MenuLockIcon />
                  </Link>
                ) : l.external ? (
                  <a
                    key={l.label}
                    href={l.href}
                    className={linkClass}
                    {...(l.newTab
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {l.label}
                  </a>
                ) : l.children ? (
                  // 入れ子リンク: 親リンクの下に一段小さく・薄く並べる (左罫線で階層を示す)。
                  <div key={l.label} className="flex flex-col gap-2">
                    <Link
                      href={l.href}
                      prefetch={navigationPrefetch}
                      className={linkClass}
                    >
                      {l.label}
                    </Link>
                    <div className="ml-1 flex flex-col gap-2 border-l border-[#E9E9F2] pl-3">
                      {l.children.map((c) => (
                        <Link
                          key={c.label}
                          href={c.href}
                          prefetch={navigationPrefetch}
                          // 14px + 短縮ラベル: モバイル2カラム時 (実効幅 ~118px) でも
                          // 1行に収まるサイズ。15px だと8文字ラベルが折り返す。
                          className="w-fit text-[14px] text-[#8A8AA3] transition-colors hover:text-[#5B5BEF]"
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={l.label}
                    href={l.href}
                    prefetch={navigationPrefetch}
                    className={linkClass}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          ))}
        </div>

        {/* 区切り線 */}
        <div aria-hidden="true" className="my-12 border-t border-[#2E2E5C]/10" />

        {/* 下段: コピーライト + 規約リンク(小さく横並び)/注記 + SNS */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-[16px] text-[#8A8AA3]">
                © {new Date().getFullYear()} {content.copyright}
              </p>
              <nav
                aria-label={content.legalAriaLabel}
                className="flex flex-wrap items-center gap-x-3 gap-y-1"
              >
                {content.legalLinks.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    prefetch={navigationPrefetch}
                    className="text-[13px] text-[#8A8AA3] underline-offset-2 transition-colors hover:text-[#5B5BEF] hover:underline"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
            <p className="max-w-[720px] text-[15px] leading-relaxed text-[#8A8AA3]">
              {content.disclaimer}
            </p>
          </div>

          {/* SNS 公式アカウント */}
          <div className="flex items-center gap-3">
            {SOCIALS.filter((social) => social.href !== "#").map((s) => (
              <a
                key={s.label.ja}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label[locale]}
                className={
                  s.badgeLabel
                    ? "flex h-10 items-center justify-center gap-2 rounded-full border border-[#2E2E5C]/15 bg-white px-4 text-[14px] font-bold text-[#5A5A7A] transition-colors hover:border-[#5B5BEF] hover:text-[#5B5BEF]"
                    : "flex h-10 w-10 items-center justify-center rounded-full border border-[#2E2E5C]/15 text-[#5A5A7A] transition-colors hover:border-[#5B5BEF] hover:text-[#5B5BEF]"
                }
              >
                {s.icon}
                {s.badgeLabel ? <span>{s.badgeLabel[locale]}</span> : null}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* 未診断でロック中の友達診断テストを押したときの吹き出し (BottomNav/TopHeader と共用)。
          画面下部・ボトムナビの友達診断タブの真上に出る。 */}
      <TakoLockPopover
        isOpen={takoLockOpen}
        onClose={() => setTakoLockOpen(false)}
        locale={locale}
      />
    </footer>
  );
}

// 未診断時に「友達診断テスト」の横に付けるミニ南京錠。TopHeader の MenuLockIcon と同モチーフ。
function MenuLockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" fill="currentColor" />
      <path
        d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
