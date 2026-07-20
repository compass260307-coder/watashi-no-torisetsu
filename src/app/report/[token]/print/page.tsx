// PDF生成専用の詳細レポート描画ページ: /report/[token]/print
//
// フルアクセス購入者向けの、32タイプ別パーソナリティレポート。
// 課金完了メールのリンク先にはせず、PDFルートが内部で開いて印刷する。

import type { CSSProperties } from "react";
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
  thirtyTwoGroup,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { cardColorsForGroup, heroColorsForGroup } from "@/lib/hero-colors";
import type { BigFiveDimension } from "@/lib/types";
import {
  detailedReportFor,
  type ReportSection,
} from "@/lib/detailed-report-content";
import { ReportPrintButton } from "@/components/report/ReportPrintButton";
import styles from "./page.module.css";

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

type ScoreMeta = {
  key: BigFiveDimension;
  label: string;
  low: string;
  high: string;
};

const SCORE_META: ScoreMeta[] = [
  { key: "O", label: "新しい体験へのひらかれ", low: "慣れ親しんだものを大切にする", high: "新しい世界を楽しむ" },
  { key: "C", label: "ものごとの進め方", low: "流れに合わせて柔軟に進む", high: "計画を立てて着実に進む" },
  { key: "E", label: "エネルギーの向かう先", low: "ひとりの時間で整える", high: "人との時間で活気づく" },
  { key: "A", label: "人との向き合い方", low: "率直さと合理性を重んじる", high: "調和と思いやりを重んじる" },
  { key: "N", label: "刺激への敏感さ", low: "落ち着いて受け止める", high: "細かな変化を感じ取る" },
];

const OCEAN: readonly BigFiveDimension[] = ["O", "C", "E", "A", "N"];

const PREVIEW_SCORES: Partial<Record<BigFiveDimension, number>> = {
  O: 8.4,
  C: 6.2,
  E: 3.7,
  A: 8.8,
  N: 7.9,
};

const CHAPTER_SCENES: Partial<Record<number, "normal1" | "normal2" | "love" | "school" | "work">> = {
  0: "normal1",
  2: "love",
  3: "normal2",
  4: "school",
  5: "work",
  7: "normal2",
};

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp = await searchParams;

  const rawPreview = typeof sp.previewType === "string" ? sp.previewType : "";
  const previewType: ThirtyTwoTypeId | null =
    process.env.NODE_ENV !== "production" && /^[a-z-]+__[NR]$/.test(rawPreview)
      ? (rawPreview as ThirtyTwoTypeId)
      : null;

  let t32: ThirtyTwoTypeId;
  let displayName: string | null = null;
  let scores: Partial<Record<BigFiveDimension, number>> = {};

  if (previewType) {
    t32 = previewType;
    displayName = "プレビュー";
    scores = PREVIEW_SCORES;
  } else {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, scores, display_name")
      .eq("owner_token", token)
      .maybeSingle();
    if (error) {
      console.error("[/report/[token]/print] users lookup error:", error);
    }
    const user = data as ReportUserRow | null;
    if (!user) {
      notFound();
    }

    const paid = await hasFullAccess(user.id);
    if (!paid) {
      return <LockedScreen token={token} />;
    }

    scores = user.scores ?? {};
    t32 = classifyThirtyTwoType(scores);
    displayName = user.display_name;
  }

  const report = detailedReportFor(t32);
  if (!report) {
    console.error(`[/report/[token]/print] missing report content for ${t32}`);
    notFound();
  }

  const name = thirtyTwoName(t32);
  const essence = thirtyTwoEssence(t32);
  const catchphrase = thirtyTwoCatchphrase(t32);
  const color = thirtyTwoColor(t32);
  const group = thirtyTwoGroup(t32);
  const { heroBg: coverBackground, codeTint: coverAccent } = heroColorsForGroup(group);
  const { panelBg: coverSoft } = cardColorsForGroup(group);
  const imagePath = thirtyTwoImagePath(t32);
  const cutImagePath = imagePath.replace("/characters/v3/", "/characters/cut/");
  const greeting = (displayName ?? "").trim();
  const reportStyle = {
    "--report-accent": color,
    "--report-accent-soft": `${color}2B`,
    "--report-accent-wash": `${color}12`,
    "--cover-background": coverBackground,
    "--cover-accent": coverAccent,
    "--cover-accent-soft": `${coverAccent}38`,
    "--cover-soft": coverSoft,
  } as CSSProperties;

  return (
    <main className={styles.reportRoot} style={reportStyle}>
      <div className={styles.screenToolbar}>
        <p>完全版PDF プレビュー</p>
        <ReportPrintButton />
      </div>

      <article className={styles.reportDocument}>
        <header className={styles.cover}>
          <div className={styles.coverOrbOne} aria-hidden="true" />
          <div className={styles.coverOrbTwo} aria-hidden="true" />
          <p className={styles.coverBrand}>WATASHI NO TORISETSU</p>
          <p className={styles.coverLabel}>PERSONALITY PROFILE</p>

          <div className={styles.coverVisual}>
            <Image
              src={cutImagePath}
              alt={name}
              width={900}
              height={900}
              className={styles.coverImage}
              priority
            />
          </div>

          <div className={styles.coverCopy}>
            <p className={styles.coverEssence}>{name}</p>
            <h1 className={styles.coverTitle}>{essence}</h1>
            <p className={styles.coverSubtitle}>パーソナリティプロフィール</p>
            <CoverOcean scores={scores} />
            <p className={styles.coverQuote}>「{catchphrase}」</p>
          </div>

          <div className={styles.coverFooter}>
            <span>{greeting ? `${greeting}さんのレポート` : "あなたのレポート"}</span>
            <span>SELF-DISCOVERY REPORT</span>
          </div>
        </header>

        <section className={styles.overviewPage}>
          <p className={styles.pageEyebrow}>YOUR PROFILE</p>
          <h2 className={styles.overviewTitle}>このレポートの読み方</h2>
          <p className={styles.leadText}>
            この一冊は、自己診断で表れた5つの傾向と、そこから導かれた
            <strong>{name}</strong>の人物像を重ねて読み解いたものです。
            どの傾向にも良し悪しはありません。今の自分に当てはまるところを手がかりに、
            自分らしい選び方や、人との心地よい距離を見つけてください。
          </p>

          <div className={styles.profileStatement}>
            <p>{essence}型の核</p>
            <strong>{catchphrase}</strong>
          </div>

          <div className={styles.scoreSection}>
            <div className={styles.sectionHeadingRow}>
              <h3>5つの傾向</h3>
              <span>自己診断スコア / 10</span>
            </div>
            <div className={styles.scoreList}>
              {SCORE_META.map((meta) => (
                <ScoreRow key={meta.key} meta={meta} value={scores[meta.key]} />
              ))}
            </div>
          </div>

          <nav className={styles.contents} aria-label="目次">
            <p className={styles.contentsLabel}>CONTENTS</p>
            <ol>
              {report.chapters.map((chapter, index) => (
                <li key={chapter.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{chapter.title}</span>
                </li>
              ))}
            </ol>
          </nav>
        </section>

        {report.chapters.map((chapter, index) => {
          const scene = CHAPTER_SCENES[index];
          const scenePath = scene ? `/characters/scenes/${group}_${scene}.webp` : null;

          return (
            <section
              key={chapter.title}
              className={`${styles.chapter} ${index === 2 ? styles.flowChapter : ""}`}
            >
              <header className={styles.chapterHeader}>
                <p className={styles.chapterNumber}>CHAPTER {String(index + 1).padStart(2, "0")}</p>
                <h2>{chapter.title}</h2>
                <span className={styles.chapterRule} aria-hidden="true" />
              </header>

              {scenePath ? (
                <figure className={styles.sceneFigure}>
                  <Image
                    src={scenePath}
                    alt=""
                    width={1500}
                    height={850}
                    className={styles.sceneImage}
                    loading="eager"
                    sizes="680px"
                  />
                </figure>
              ) : null}

              <div className={styles.chapterBody}>
                {chapter.sections.map((section, sectionIndex) => (
                  <ReportSectionBlock
                    key={sectionIndex}
                    section={section}
                    isFirst={sectionIndex === 0}
                  />
                ))}
              </div>
            </section>
          );
        })}

        <footer className={styles.endPage}>
          <p className={styles.pageEyebrow}>KEEP THIS CLOSE</p>
          <h2>迷ったときに、何度でも。</h2>
          <p>
            性格は、決めつけるための答えではなく、自分を理解するための地図です。
            状況や経験によって感じ方が変わったときは、またこのレポートを開いてください。
          </p>
          <div className={styles.endMark}>ワタシのトリセツ</div>
          <Link
            href={`/me/${encodeURIComponent(previewType ? "preview" : token)}`}
            className={styles.backLink}
          >
            埋まった自己診断結果を見る
          </Link>
        </footer>
      </article>
    </main>
  );
}

function CoverOcean({ scores }: { scores: Partial<Record<BigFiveDimension, number>> }) {
  const code = OCEAN.map((key) => ((scores[key] ?? 5) >= 5 ? key : key.toLowerCase())).join("");

  return (
    <div className={styles.coverOcean} aria-label={`OCEANコード ${code}`}>
      {OCEAN.map((key) => {
        const high = (scores[key] ?? 5) >= 5;

        return (
          <span key={key} className={high ? styles.coverOceanHigh : styles.coverOceanLow}>
            {high ? key : key.toLowerCase()}
          </span>
        );
      })}
    </div>
  );
}

function ScoreRow({ meta, value }: { meta: ScoreMeta; value: number | undefined }) {
  const normalized = Math.max(0, Math.min(10, typeof value === "number" ? value : 5));
  const leaning = normalized >= 5 ? meta.high : meta.low;

  return (
    <div className={styles.scoreRow}>
      <div className={styles.scoreCopy}>
        <div>
          <span className={styles.scoreKey}>{meta.key}</span>
          <strong>{meta.label}</strong>
        </div>
      </div>
      <div className={styles.scoreTrack} aria-hidden="true">
        <span style={{ width: `${normalized * 10}%` }} />
      </div>
      <p>
        {leaning}（{normalized.toFixed(1)} / 10）
      </p>
    </div>
  );
}

function ReportSectionBlock({
  section,
  isFirst,
}: {
  section: ReportSection;
  isFirst: boolean;
}) {
  return (
    <div className={`${styles.sectionBlock} ${isFirst ? styles.firstSection : ""}`}>
      {section.heading ? <h3>{section.heading}</h3> : null}
      {section.quote ? <blockquote>{section.quote}</blockquote> : null}
      {section.body
        ? section.body.split("\n\n").map((paragraph, index) => (
            <p key={index} className={styles.bodyParagraph}>
              {paragraph}
            </p>
          ))
        : null}
      {section.bullets && section.bullets.length > 0 ? (
        <ul className={styles.bulletList}>
          {section.bullets.map((bullet) => (
            <li key={bullet.title}>
              <h4>
                <span aria-hidden="true" />
                {bullet.title}
              </h4>
              <p>{bullet.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

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
