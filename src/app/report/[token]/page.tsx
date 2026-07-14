// 詳細レポート (課金特典): /report/[token]
//
// フルアクセス (¥499 全解放) 購入者だけが読める、32タイプ別の長編レポート。
// 課金完了メール (sendDetailedReportEmail) からこの URL に着地する。
//
// - token = users.owner_token (閲覧は /me と同じ token 認可。編集操作は無いので session 不要)
// - 未課金は本文を一切レンダリングしない (フェイルクローズ)。/me へ誘導するロック画面を出す。
// - 印刷 (ブラウザの PDF 保存) に対応: print 用スタイルは globals ではなくこのページ内の
//   クラスで完結させる。
// - ?previewType=<32タイプID> は開発環境のみ許可 (/me と同様のコンテンツ QA 用モック)。

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hasFullAccess } from "@/lib/entitlements";
import {
  classifyThirtyTwoType,
  thirtyTwoName,
  thirtyTwoEssence,
  thirtyTwoCatchphrase,
  thirtyTwoImagePath,
  thirtyTwoColor,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";
import {
  detailedReportFor,
  type ReportSection,
} from "@/lib/detailed-report-content";
import { ReportPrintButton } from "@/components/report/ReportPrintButton";

export const metadata: Metadata = {
  title: "詳細レポート | ワタシのトリセツ",
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type ReportUserRow = {
  id: string;
  scores: Partial<Record<BigFiveDimension, number>> | null;
  display_name: string | null;
};

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp = await searchParams;

  // ===== プレビュー (開発のみ): ?previewType=<32タイプID> でモック描画 =====
  const rawPreview = typeof sp.previewType === "string" ? sp.previewType : "";
  const previewType: ThirtyTwoTypeId | null =
    process.env.NODE_ENV !== "production" && /^[a-z-]+__[NR]$/.test(rawPreview)
      ? (rawPreview as ThirtyTwoTypeId)
      : null;

  let t32: ThirtyTwoTypeId;
  let displayName: string | null = null;

  if (previewType) {
    t32 = previewType;
    displayName = "プレビュー";
  } else {
    // ===== token → users 行 =====
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, scores, display_name")
      .eq("owner_token", token)
      .maybeSingle();
    if (error) {
      console.error("[/report/[token]] users lookup error:", error);
    }
    const user = data as ReportUserRow | null;
    if (!user) {
      notFound();
    }

    // ===== 課金ゲート (フェイルクローズ: 未課金は本文を解決しない) =====
    const paid = await hasFullAccess(user.id);
    if (!paid) {
      return <LockedScreen token={token} />;
    }

    t32 = classifyThirtyTwoType(
      (user.scores ?? {}) as Partial<Record<BigFiveDimension, number>>,
    );
    displayName = user.display_name;
  }

  const report = detailedReportFor(t32);
  if (!report) {
    // 全 32 タイプ登録済みの想定。欠けていたら実装ミスなので 404 に落とす。
    console.error(`[/report/[token]] missing report content for ${t32}`);
    notFound();
  }

  const name = thirtyTwoName(t32);
  const essence = thirtyTwoEssence(t32);
  const catchphrase = thirtyTwoCatchphrase(t32);
  const color = thirtyTwoColor(t32);
  const imagePath = thirtyTwoImagePath(t32);
  const greeting = (displayName ?? "").trim();

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#2A2520]">
      <div className="mx-auto max-w-2xl px-5 pb-20 pt-10 print:max-w-none print:px-0 print:pt-0">
        {/* ===== 表紙 ===== */}
        <header className="mb-12 text-center">
          <p className="mb-6 text-[11px] tracking-[0.25em] text-[#A89E8E]">
            WATASHI NO TORISETSU
          </p>
          <div
            className="mx-auto mb-8 rounded-3xl border border-[#E8E1D5] px-6 pb-8 pt-10"
            style={{ backgroundColor: `${color}22` }}
          >
            <Image
              src={imagePath}
              alt={name}
              width={200}
              height={200}
              className="mx-auto mb-6 h-40 w-40 object-contain"
              priority
            />
            <h1 className="mb-1 text-3xl font-bold leading-snug">{name}</h1>
            <p className="mb-4 text-sm font-semibold text-[#6B6359]">
              {essence}型のパーソナリティレポート
            </p>
            <p className="text-sm leading-relaxed text-[#6B6359]">
              「{catchphrase}」
            </p>
          </div>
          {greeting ? (
            <p className="mb-2 text-sm text-[#6B6359]">
              {greeting}さんの診断結果をもとにした詳細レポートです
            </p>
          ) : null}
          <div className="print:hidden">
            <ReportPrintButton />
          </div>
        </header>

        {/* ===== 目次 ===== */}
        <nav className="mb-14 rounded-2xl border border-[#E8E1D5] bg-white px-6 py-6 print:hidden">
          <p className="mb-4 text-[11px] font-semibold tracking-[0.2em] text-[#A89E8E]">
            もくじ
          </p>
          <ol className="space-y-2">
            {report.chapters.map((ch, i) => (
              <li key={ch.title}>
                <a
                  href={`#chapter-${i}`}
                  className="flex items-baseline gap-3 text-sm text-[#2A2520] underline-offset-4 hover:underline"
                >
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {ch.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* ===== 本文 ===== */}
        {report.chapters.map((ch, i) => (
          <section
            key={ch.title}
            id={`chapter-${i}`}
            className="mb-14 scroll-mt-8 print:break-inside-avoid-page"
          >
            <div className="mb-6 flex items-center gap-3">
              <span
                className="rounded-full px-3 py-1 text-xs font-bold text-[#2A2520]"
                style={{ backgroundColor: color }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="text-xl font-bold">{ch.title}</h2>
            </div>
            {ch.sections.map((sec, j) => (
              <ReportSectionBlock key={j} section={sec} color={color} />
            ))}
          </section>
        ))}

        {/* ===== フッター ===== */}
        <footer className="border-t border-[#E8E1D5] pt-8 text-center">
          <p className="mb-6 text-xs leading-relaxed text-[#A89E8E]">
            このレポートは、あなたの自己診断スコアから導いた {name}
            （{essence}型）の解説です。
            <br />
            ブックマークしておくと、いつでも読み返せます。
          </p>
          <Link
            href={`/me/${encodeURIComponent(previewType ? "preview" : token)}`}
            className="inline-block rounded-full border border-[#2A2520] px-6 py-3 text-sm font-semibold print:hidden"
          >
            マイ図鑑にもどる
          </Link>
        </footer>
      </div>
    </main>
  );
}

// 章内セクション (小見出し / 引用 / 段落 / 箇条書き) の描画
function ReportSectionBlock({
  section,
  color,
}: {
  section: ReportSection;
  color: string;
}) {
  return (
    <div className="mb-8">
      {section.heading ? (
        <h3 className="mb-3 text-base font-bold" style={{ color: "#2A2520" }}>
          <span
            className="mr-2 inline-block h-3 w-1 rounded-full align-middle"
            style={{ backgroundColor: color }}
          />
          {section.heading}
        </h3>
      ) : null}
      {section.quote ? (
        <blockquote
          className="mb-5 border-y px-4 py-4 text-center text-sm font-semibold leading-relaxed text-[#6B6359]"
          style={{ borderColor: color }}
        >
          {section.quote}
        </blockquote>
      ) : null}
      {section.body
        ? section.body.split("\n\n").map((para, i) => (
            <p
              key={i}
              className="mb-4 text-[15px] leading-[1.9] text-[#2A2520]"
            >
              {para}
            </p>
          ))
        : null}
      {section.bullets && section.bullets.length > 0 ? (
        <ul className="space-y-4">
          {section.bullets.map((b) => (
            <li
              key={b.title}
              className="rounded-xl border border-[#E8E1D5] bg-white px-5 py-4"
            >
              <p className="mb-1 text-sm font-bold">
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ backgroundColor: color }}
                />
                {b.title}
              </p>
              <p className="text-sm leading-relaxed text-[#6B6359]">{b.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// 未課金時のロック画面 (本文はサーバで一切解決していない)
function LockedScreen({ token }: { token: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-5 text-[#2A2520]">
      <div className="w-full max-w-md rounded-3xl border border-[#E8E1D5] bg-white px-8 py-10 text-center">
        <p className="mb-6 text-[11px] tracking-[0.25em] text-[#A89E8E]">
          WATASHI NO TORISETSU
        </p>
        <h1 className="mb-4 text-xl font-bold">
          詳細レポートは
          <br />
          全解放プランの特典です
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-[#6B6359]">
          あなたのタイプの長所と短所、恋愛・友人関係、キャリアまでを一冊にまとめた長編レポート。全解放プランを購入すると、メールでお届けします。
        </p>
        <Link
          href={`/me/${encodeURIComponent(token)}`}
          className="inline-block rounded-full bg-[#2A2520] px-8 py-3 text-sm font-semibold text-[#FAF7F2]"
        >
          マイ図鑑で詳しく見る
        </Link>
      </div>
    </main>
  );
}
