// Phase 3-β リリース 3 C-4: 統合トリセツ表示ページ (Server Component + OGP)
//
// 認可: なし (URL 知っている人なら閲覧可、シェアリンク前提、論点 3 a)
// 内部メタ (ai_cost_usd 等) は API レスポンスから除外済 ([id]/route.ts)
// generateMetadata で OGP 動的生成 (og:image は自己評価カード or 最初の perception カード)

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-server";
import { IntegratedShareButton } from "./IntegratedShareButton";

const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.watashi-torisetsu.com";

type SourceSummary = {
  self: { fullCode: string; name: string } | null;
  perceptions: Array<{ name: string; fullCode: string }>;
};

type IntegratedTrisetsuRow = {
  id: string;
  include_self: boolean;
  source_summary: SourceSummary;
  generated_title: string | null;
  generated_summary: string | null;
  generated_body: string;
  generated_at: string;
};

async function fetchIntegrated(
  id: string,
): Promise<IntegratedTrisetsuRow | null> {
  const { data, error } = await supabaseAdmin
    .from("integrated_trisetsu")
    .select(
      "id, include_self, source_summary, generated_title, generated_summary, generated_body, generated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[integrated/:id] fetch error:", error);
    return null;
  }
  return (data as IntegratedTrisetsuRow | null) ?? null;
}

function pickOgImageFullCode(summary: SourceSummary): string | null {
  if (summary.self?.fullCode) return summary.self.fullCode;
  if (summary.perceptions.length > 0) return summary.perceptions[0].fullCode;
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await fetchIntegrated(id);
  if (!row) {
    return {
      title: "統合トリセツが見つかりません | ワタシのトリセツ",
    };
  }
  const title =
    (row.generated_title?.trim() ?? "") || "真のトリセツ | ワタシのトリセツ";
  const summary =
    (row.generated_summary?.trim() ?? "") ||
    "複数の眼から見えた、本当の自分のトリセツ。";
  const ogImageCode = pickOgImageFullCode(row.source_summary);
  const ogImageUrl = ogImageCode
    ? `${PUBLIC_BASE_URL}/cards/${ogImageCode}.png`
    : `${PUBLIC_BASE_URL}/ogp-v3.png`;
  const pageUrl = `${PUBLIC_BASE_URL}/integrated/${id}`;

  return {
    title,
    description: summary,
    openGraph: {
      title,
      description: summary,
      url: pageUrl,
      siteName: "ワタシのトリセツ",
      images: [{ url: ogImageUrl, width: 1122, height: 1402 }],
      locale: "ja_JP",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: summary,
      images: [ogImageUrl],
    },
  };
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function IntegratedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await fetchIntegrated(id);
  if (!row) notFound();

  const title = row.generated_title?.trim() || "真のトリセツ";
  const summary = row.generated_summary?.trim() ?? "";
  const summarySource: SourceSummary = row.source_summary;
  const bodyParagraphs = row.generated_body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const sourceBadges: Array<{ key: string; label: string }> = [];
  if (row.include_self && summarySource.self) {
    sourceBadges.push({
      key: "self",
      label: `🟢 自己評価 (${summarySource.self.fullCode})`,
    });
  }
  for (const p of summarySource.perceptions) {
    sourceBadges.push({
      key: `p-${p.name}-${p.fullCode}`,
      label: `🟡 ${p.name}さんから (${p.fullCode})`,
    });
  }

  const shareUrl = `${PUBLIC_BASE_URL}/integrated/${id}`;

  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col px-5 py-8 max-w-lg mx-auto w-full pb-12">
        {/* ヘッダー: メタ情報 */}
        <header className="mb-6 animate-fade-in-up">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
            🟣 INTEGRATED TRISETSU
          </p>
          <p className="text-xs text-muted">
            生成日: {formatDate(row.generated_at)}
          </p>
        </header>

        {/* 統合元バッジ */}
        <section className="rounded-2xl border border-card-border bg-card-bg p-4 mb-6 animate-fade-in-up stagger-2">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-3">
            ── 統合した素材 ({sourceBadges.length}) ──
          </p>
          <ul className="flex flex-col gap-1.5">
            {sourceBadges.map((b) => (
              <li key={b.key} className="text-sm text-foreground">
                {b.label}
              </li>
            ))}
          </ul>
        </section>

        {/* 本文 */}
        <article className="rounded-2xl border-2 border-primary/40 bg-gradient-to-b from-white to-pink-50/30 p-6 sm:p-8 mb-6 animate-fade-in-up stagger-3 shadow-sm">
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground text-center mb-3 leading-snug">
            ✨ {title}
          </h1>
          {summary && (
            <p className="text-sm text-muted text-center mb-6 leading-relaxed border-b border-card-border pb-4">
              {summary}
            </p>
          )}
          <div className="text-base leading-loose space-y-4">
            {bodyParagraphs.map((p, i) => (
              <p key={i} className="text-foreground whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        </article>

        {/* CTA */}
        <section className="flex flex-col gap-3 mb-6">
          <IntegratedShareButton shareUrl={shareUrl} title={title} />
          <Link
            href="/integrated/new"
            className="w-full rounded-full border-2 border-primary text-primary text-center px-6 py-3 text-sm font-bold transition-all hover:bg-label-bg active:scale-[0.98]"
          >
            ✨ もう一度、別の組み合わせで作る
          </Link>
          <Link
            href="/zukan-mine"
            className="text-xs text-muted underline text-center hover:text-foreground transition-colors mt-2"
          >
            🎴 マイ図鑑に戻る
          </Link>
        </section>
      </main>
    </div>
  );
}
