// プレミアム化 v3 Day 8: マジックリンク検証エラーページ (本格版)
//
// /auth/error?reason=missing_token|invalid_or_expired|server_error
//
// 各 reason に応じた本文 + CTA (再発行 = /login への遷移) を表示。
// 二次 CTA としてトップへ戻る導線も用意。

import Link from "next/link";

type SearchParams = Promise<{ reason?: string; locale?: string }>;

interface ReasonContent {
  heading: string;
  description: string;
  primaryAction?: {
    label: string;
    href: string;
  };
}

const REASON_CONTENT: Record<string, ReasonContent> = {
  missing_token: {
    heading: "リンクが不完全です",
    description:
      "リンクの一部が欠けているか、正しくコピーされていない可能性があります。お送りしたメールから、もう一度リンクを開いてください。",
    primaryAction: {
      label: "ログインリンクを再発行",
      href: "/login",
    },
  },
  invalid_or_expired: {
    heading: "このリンクは利用できません",
    description:
      "リンクの期限が切れているか、既に使用されています。リンクの有効期限は発行から 1 時間で、一度開くと無効になります。新しいリンクを発行してお試しください。",
    primaryAction: {
      label: "ログインリンクを再発行",
      href: "/login",
    },
  },
  server_error: {
    heading: "サーバーで問題が発生しました",
    description:
      "一時的な問題が起きています。少し時間をおいてもう一度お試しください。状況が続く場合は、新しいリンクを発行してください。",
    primaryAction: {
      label: "ログインリンクを再発行",
      href: "/login",
    },
  },
};

const FALLBACK: ReasonContent = {
  heading: "リンクが利用できません",
  description:
    "リンクの確認に失敗しました。新しいリンクを発行してお試しください。",
  primaryAction: {
    label: "ログインリンクを再発行",
    href: "/login",
  },
};

const KO_REASON_CONTENT: Record<string, ReasonContent> = {
  missing_token: {
    heading: "링크가 완전하지 않아요",
    description:
      "링크 일부가 빠졌거나 올바르게 복사되지 않았을 수 있어요. 받은 이메일에서 링크를 다시 열어 주세요.",
    primaryAction: { label: "로그인 링크 다시 받기", href: "/ko/login" },
  },
  invalid_or_expired: {
    heading: "사용할 수 없는 링크예요",
    description:
      "링크가 만료되었거나 이미 사용되었어요. 로그인 링크는 발급 후 1시간 동안 한 번만 사용할 수 있어요.",
    primaryAction: { label: "로그인 링크 다시 받기", href: "/ko/login" },
  },
  server_error: {
    heading: "일시적인 문제가 발생했어요",
    description:
      "잠시 뒤 다시 시도해 주세요. 문제가 계속되면 새 로그인 링크를 받아 주세요.",
    primaryAction: { label: "로그인 링크 다시 받기", href: "/ko/login" },
  },
};

const KO_FALLBACK: ReasonContent = {
  heading: "링크를 확인할 수 없어요",
  description: "새 로그인 링크를 받아 다시 시도해 주세요.",
  primaryAction: { label: "로그인 링크 다시 받기", href: "/ko/login" },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { reason, locale } = await searchParams;
  const isKorean = locale === "ko";
  const contentMap = isKorean ? KO_REASON_CONTENT : REASON_CONTENT;
  const content: ReasonContent =
    (reason ? contentMap[reason] : undefined) ??
    (isKorean ? KO_FALLBACK : FALLBACK);

  return (
    <main className="flex flex-col flex-1 items-center justify-center px-5 py-10 max-w-lg mx-auto w-full">
      <header className="text-center mb-8 animate-fade-in-up">
        <p className="text-[10px] font-bold tracking-wider text-muted mb-3">
          {isKorean ? "로그인 링크 오류" : "AUTH ERROR"}
        </p>
        <h1 className="text-2xl font-extrabold leading-tight">
          {content.heading}
        </h1>
      </header>

      <section className="w-full mb-8 animate-fade-in-up stagger-2">
        <p className="text-sm text-foreground text-center leading-relaxed">
          {content.description}
        </p>
      </section>

      {content.primaryAction && (
        <Link
          href={content.primaryAction.href}
          className="rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] animate-fade-in-up stagger-3"
        >
          {content.primaryAction.label}
        </Link>
      )}

      <Link
        href={isKorean ? "/ko" : "/"}
        className="text-xs text-muted/70 underline hover:text-foreground text-center mt-8"
      >
        {isKorean ? "홈으로 돌아가기" : "トップに戻る"}
      </Link>
    </main>
  );
}
