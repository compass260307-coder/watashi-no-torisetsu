"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// feat/top-page: トップページのフッター (16Personalities 型のマルチカラム)。
// 配色は Sora (navy #2E2E5C 見出し / blue #5B5BEF アクセント)、フォントは Noto Sans JP。
// リンクは実在ルートのみ。SNS アイコンは ⚠️ プレースホルダ (href を実 URL に差し替え)。
// 友達診断テストの遷移先解決 (localStorage) のためクライアントコンポーネント。

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

// external: Next の Link を使わない生 <a> (mailto / 外部サイト)。
// newTab: 外部サイトは別タブで開く (target="_blank" + rel="noopener noreferrer")。
// disabled: 準備中 (グレー表示・リンクなし)。ページが公開できたら外す。
type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
  newTab?: boolean;
  disabled?: boolean;
};

// 3 カラム (診断 / サービス / サポート)。規約系は最下段 (コピーライト横) に移動。
const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "診断",
    links: [
      { label: "性格診断テスト", href: "/diagnosis" },
      // 友達診断テストの href は実行時に上書き (BottomNav/TopHeader と同じ /tako/[token] 解決)。
      { label: "友達診断テスト", href: "/tako" },
      { label: "性格タイプ", href: "/types" },
      // 一時停止 (2026-07-20): /unmei 表示が未完成のため導線を止める。再開時はコメント解除。
      // { label: "運命の設計図", href: "/unmei" },
    ],
  },
  {
    title: "サービス",
    links: [
      { label: "サービスについて", href: "/about" },
      { label: "記事・コラム", href: "/articles" },
      {
        label: "運営会社",
        href: "https://sora-team.com",
        external: true,
        newTab: true,
      },
      // ⚠️ note / 記事: URL が決まったら有効化する。
      // { label: "note / 記事", href: "", external: true, newTab: true },
    ],
  },
  {
    title: "サポート",
    links: [
      {
        label: "お問い合わせ",
        href: "mailto:support@watashi-torisetsu.com",
        external: true,
      },
      // ⚠️ よくある質問: 専用ページ未実装のため一旦非表示 (現状は /about 内の一節のみ)。
      // { label: "よくある質問", href: "/faq" },
    ],
  },
];

// 最下段 (コピーライト横に小さく横並び) の規約リンク。
const LEGAL_LINKS: FooterLink[] = [
  { label: "利用規約", href: "/terms" },
  { label: "プライバシーポリシー", href: "/privacy" },
  { label: "特定商取引法に基づく表記", href: "/legal/commerce" },
];

// ⚠️ SNS は実 URL に差し替え (現状はプレースホルダ #)
const SOCIALS: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "Instagram",
    href: "#",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "X (旧Twitter)",
    href: "#",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
      </svg>
    ),
  },
  {
    label: "LINE",
    href: "#",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 4c4.97 0 9 3.13 9 7 0 3.87-4.03 7-9 7-.62 0-1.23-.05-1.8-.14L6 20.5l.9-3.06C4.53 16.16 3 14.25 3 11c0-3.87 4.03-7 9-7Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function TopFooter() {
  const pathname = usePathname() ?? "/";

  // 友達診断テストの遷移先を BottomNav/TopHeader と同じルールで解決:
  //   localStorage の owner_token があれば /tako/[token]、無ければ /tako (未診断ガード)。
  const [takoUrl, setTakoUrl] = useState("/tako");
  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // localStorage 不可環境: フォールバックのまま。
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTakoUrl(token ? `/tako/${token}` : "/tako");
  }, [pathname]);

  const columns = COLUMNS.map((col) => ({
    ...col,
    links: col.links.map((l) =>
      l.label === "友達診断テスト" ? { ...l, href: takoUrl } : l,
    ),
  }));

  // MBTI(16Personalities) 風: リンクは色つき(ミュートした Sora ブルー)。
  const linkClass =
    "text-[18px] text-[#6E72C8] transition-colors hover:text-[#5B5BEF] w-fit";

  return (
    <footer
      className="w-full bg-white px-8 py-20"
      style={{ fontFamily: FONT_STACK }}
    >
      {/* MBTI 風: 中央寄せのコンテナ(左右に余白) + エアリーな間隔。
          幅は自己診断結果 (/me) と同じ max-w-[1080px] に統一する。 */}
      <div className="mx-auto max-w-[1080px]">
        {/* リンク列 */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-3">
          {columns.map((col) => (
            <nav key={col.title} className="flex flex-col gap-4">
              <p className="mb-1 text-[18px] font-bold text-[#2E2E5C]">{col.title}</p>
              {col.links.map((l) =>
                l.disabled ? (
                  <span
                    key={l.label}
                    className="w-fit text-[18px] text-[#B4B4C4]"
                    aria-disabled="true"
                  >
                    {l.label}
                    <span className="text-[12px]">（準備中）</span>
                  </span>
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
                ) : (
                  <Link key={l.label} href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                ),
              )}
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
                © {new Date().getFullYear()} ワタシのトリセツ運営事務局
              </p>
              <nav
                aria-label="規約"
                className="flex flex-wrap items-center gap-x-3 gap-y-1"
              >
                {LEGAL_LINKS.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    className="text-[13px] text-[#8A8AA3] underline-offset-2 transition-colors hover:text-[#5B5BEF] hover:underline"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
            <p className="max-w-[720px] text-[15px] leading-relaxed text-[#8A8AA3]">
              ワタシのトリセツ（私の取説）は、OCEAN（ビッグファイブ）診断と友達の回答で「自分の取扱説明書」を作る無料の性格診断サービスです。診断結果は
              Big Five
              理論をベースにした、自分を知るための参考情報です。医学的・心理学的な診断を行うものではありません。
            </p>
          </div>

          {/* SNS (⚠️ href を実 URL に差し替え) */}
          <div className="flex items-center gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2E2E5C]/15 text-[#5A5A7A] transition-colors hover:border-[#5B5BEF] hover:text-[#5B5BEF]"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
