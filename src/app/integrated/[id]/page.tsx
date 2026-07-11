// Phase 3-β リリース 3 C-4: 統合トリセツ表示ページ (Server Component + OGP)
// プレミアム化 v2 (Week 1 T1-6): 7 章 generated_chapters JSONB に対応
//
// 認可: なし (URL 知っている人なら閲覧可、シェアリンク前提、論点 3 a)
// 内部メタ (ai_cost_usd 等) は API レスポンスから除外済 ([id]/route.ts)
// generateMetadata で OGP 動的生成 (og:image は自己評価カード or 最初の perception カード)
//
// status 分岐:
//   - 'completed' (chapters あり) → 7 章レンダリング
//   - 'completed' (chapters 無し、旧スキーマ生成) → 「古い形式」フォールバック画面
//   - 'failed' → 失敗画面 (再生成 CTA は T2 で実装、ここでは表示まで)
//   - 'pending' / 'generating' → 「生成中」プレースホルダ (T1-4 時点では発生しないが防御的に)

import { notFound } from "next/navigation";
import { resolveSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-server";
import { CHAPTER_KEYS, type ChapterKey } from "@/lib/anthropic-client";
import { IntegratedShareButton } from "./IntegratedShareButton";
import { IntegratedDownloadButton } from "./IntegratedDownloadButton";

// 空文字 "" も弾くため || を使用 (?? は "" を通してしまい相対URL化するため不可)。
const PUBLIC_BASE_URL =
  resolveSiteUrl();

type SourceSummary = {
  self: { fullCode: string; name: string } | null;
  perceptions: Array<{ name: string; fullCode: string }>;
};

type GeneratedChapter = {
  title?: string;
  subtitle?: string;
  body?: string;
};

type GeneratedChapters = Partial<Record<ChapterKey, GeneratedChapter>>;

type IntegratedTrisetsuRow = {
  id: string;
  include_self: boolean;
  source_summary: SourceSummary;
  status: string | null;
  failure_reason: string | null;
  generated_title: string | null;
  generated_subtitle: string | null;
  generated_chapters: GeneratedChapters | null;
  generated_at: string;
};

async function fetchIntegrated(
  id: string,
): Promise<IntegratedTrisetsuRow | null> {
  const { data, error } = await supabaseAdmin
    .from("integrated_trisetsu")
    .select(
      "id, include_self, source_summary, status, failure_reason, generated_title, generated_subtitle, generated_chapters, generated_at",
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
  const subtitle =
    (row.generated_subtitle?.trim() ?? "") ||
    "複数の眼から見えた、本当の自分のトリセツ。";
  const ogImageCode = pickOgImageFullCode(row.source_summary);
  const ogImageUrl = ogImageCode
    ? `${PUBLIC_BASE_URL}/cards/${ogImageCode}.jpg`
    : `${PUBLIC_BASE_URL}/ogp-v4.png`;
  const pageUrl = `${PUBLIC_BASE_URL}/integrated/${id}`;

  return {
    title,
    description: subtitle,
    openGraph: {
      title,
      description: subtitle,
      url: pageUrl,
      siteName: "ワタシのトリセツ",
      images: [{ url: ogImageUrl, width: 1122, height: 1402 }],
      locale: "ja_JP",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: subtitle,
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

const CHAPTER_NUMBER_JA = ["一", "二", "三", "四", "五", "六", "七"] as const;

function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function chapterHasContent(ch: GeneratedChapter | undefined): boolean {
  return Boolean(ch?.body && ch.body.trim().length > 0);
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
  const subtitle = row.generated_subtitle?.trim() ?? "";
  const summarySource: SourceSummary = row.source_summary;

  const sourceBadges: Array<{ key: string; label: string }> = [];
  if (row.include_self && summarySource.self) {
    sourceBadges.push({
      key: "self",
      label: `自己評価 (${summarySource.self.fullCode})`,
    });
  }
  for (const p of summarySource.perceptions) {
    sourceBadges.push({
      key: `p-${p.name}-${p.fullCode}`,
      label: `${p.name}さんから (${p.fullCode})`,
    });
  }

  const shareUrl = `${PUBLIC_BASE_URL}/integrated/${id}`;
  const status = row.status ?? "completed";
  const chapters = row.generated_chapters ?? {};
  const hasAnyChapter = CHAPTER_KEYS.some((k) => chapterHasContent(chapters[k]));

  // ─────────────────────────────────────────
  // 失敗・進行中・旧形式のフォールバック画面
  // ─────────────────────────────────────────
  if (status === "failed") {
    return (
      <FallbackLayout
        label="ERROR"
        title="生成に失敗しました"
        message="申し訳ありません、AI 統合トリセツの生成中に問題が発生しました。"
        secondary={row.failure_reason ? `詳細: ${row.failure_reason}` : null}
        generatedAt={row.generated_at}
      />
    );
  }
  if (status === "pending" || status === "generating") {
    return (
      <FallbackLayout
        label="GENERATING"
        title="生成中です"
        message="AI が統合トリセツを作成しています。完了まで 30-90 秒ほどお待ちください。"
        secondary="ページを再読み込みすると最新の状態が表示されます。"
        generatedAt={row.generated_at}
      />
    );
  }
  if (!hasAnyChapter) {
    // status='completed' なのに chapters 無し = 旧スキーマ時代のレコード or データ欠落
    return (
      <FallbackLayout
        label="LEGACY"
        title="古い形式のトリセツです"
        message="このトリセツはプレミアム版以前の形式で生成されているため、新フォーマットでは表示できません。"
        secondary="新しい統合トリセツを生成すると、7 章構成の本格レポートが手に入ります。"
        generatedAt={row.generated_at}
        showCreateNewCta
      />
    );
  }

  // ─────────────────────────────────────────
  // 完成: 7 章レンダリング
  // ─────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col px-5 py-8 max-w-2xl mx-auto w-full pb-16">
        {/* ヘッダー: メタ情報 */}
        <header className="mb-6 animate-fade-in-up">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
            INTEGRATED TRISETSU
          </p>
          <p className="text-xs text-muted">
            生成日: {formatDate(row.generated_at)}
          </p>
        </header>

        {/* 統合元バッジ */}
        <section className="rounded-2xl border border-card-border bg-card-bg p-4 mb-8 animate-fade-in-up stagger-2">
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

        {/* タイトル + 副題 */}
        <section className="text-center mb-12 animate-fade-in-up stagger-3">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground leading-snug mb-3">
            {title}
          </h1>
          {subtitle && (
            <p className="font-serif text-sm sm:text-base text-muted leading-relaxed italic">
              {subtitle}
            </p>
          )}
          <div className="mt-6 mx-auto w-16 border-t border-primary/40" />
        </section>

        {/* 7 章本文 */}
        <article className="flex flex-col gap-10 mb-10">
          {CHAPTER_KEYS.map((key, idx) => {
            const ch = chapters[key];
            if (!chapterHasContent(ch)) return null;
            return (
              <ChapterSection
                key={key}
                chapterIndex={idx}
                chapter={ch as GeneratedChapter}
              />
            );
          })}
        </article>

        {/* CTA */}
        <section className="flex flex-col gap-3 mt-4">
          {/* プライマリ: PDF ダウンロード (所有者のみ実行可) */}
          <IntegratedDownloadButton integratedId={id} />
          {/* セカンダリ: シェア */}
          <IntegratedShareButton shareUrl={shareUrl} title={title} />
          <Link
            href="/integrated/new"
            className="w-full rounded-full border-2 border-primary text-primary text-center px-6 py-3 text-sm font-bold transition-all hover:bg-label-bg active:scale-[0.98]"
          >
            もう一度、別の組み合わせで作る
          </Link>
          <Link
            href="/zukan-mine"
            className="text-xs text-muted underline text-center hover:text-foreground transition-colors mt-2"
          >
            マイ図鑑に戻る
          </Link>
        </section>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────
// 章ブロック
// ─────────────────────────────────────────
function ChapterSection({
  chapterIndex,
  chapter,
}: {
  chapterIndex: number;
  chapter: GeneratedChapter;
}) {
  const numberJa = CHAPTER_NUMBER_JA[chapterIndex] ?? String(chapterIndex + 1);
  const paragraphs = splitParagraphs(chapter.body ?? "");
  return (
    <section className="animate-fade-in-up">
      <header className="mb-5">
        <p className="font-serif text-xs tracking-[0.3em] text-primary/70 mb-2">
          第 {numberJa} 章
        </p>
        <h2 className="font-serif text-xl sm:text-2xl font-bold text-foreground leading-snug">
          {chapter.title ?? ""}
        </h2>
        {chapter.subtitle && (
          <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
            〜 {chapter.subtitle} 〜
          </p>
        )}
      </header>
      <div
        className="text-[15px] sm:text-base text-foreground space-y-5"
        style={{ lineHeight: 1.9 }}
      >
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────
// フォールバック画面 (failed / pending / 旧形式)
// ─────────────────────────────────────────
function FallbackLayout({
  label,
  title,
  message,
  secondary,
  generatedAt,
  showCreateNewCta = false,
}: {
  /** タイポグラフィのみで状態を表現 (T3-5、絵文字不使用): "ERROR" / "GENERATING" / "LEGACY" */
  label: string;
  title: string;
  message: string;
  secondary: string | null;
  generatedAt: string;
  showCreateNewCta?: boolean;
}) {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col px-5 py-8 max-w-lg mx-auto w-full pb-12">
        <header className="mb-6 animate-fade-in-up">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
            INTEGRATED TRISETSU
          </p>
          <p className="text-xs text-muted">
            生成日: {formatDate(generatedAt)}
          </p>
        </header>
        <section className="rounded-2xl border-2 border-card-border bg-card-bg p-6 sm:p-8 text-center mb-6 animate-fade-in-up stagger-2">
          <p className="font-serif text-xs tracking-[0.4em] text-primary/70 mb-4">
            {label}
          </p>
          <h1 className="font-serif text-lg sm:text-xl font-bold text-foreground mb-3">
            {title}
          </h1>
          <p className="text-sm text-foreground leading-relaxed mb-3">
            {message}
          </p>
          {secondary && (
            <p className="text-xs text-muted leading-relaxed">{secondary}</p>
          )}
        </section>
        <section className="flex flex-col gap-3">
          {showCreateNewCta && (
            <Link
              href="/integrated/new"
              className="w-full rounded-full bg-primary-gradient text-white text-center px-6 py-3 text-sm font-bold shadow-md transition-all active:scale-[0.98]"
            >
              新しい統合トリセツを作る
            </Link>
          )}
          <Link
            href="/zukan-mine"
            className="text-xs text-muted underline text-center hover:text-foreground transition-colors mt-2"
          >
            マイ図鑑に戻る
          </Link>
        </section>
      </main>
    </div>
  );
}
