// PDF生成専用の詳細レポート描画ページ: /report/[token]/print
//
// フルアクセス購入者向けの、32タイプ別パーソナリティレポート。
// 課金完了メールのリンク先にはせず、PDFルートが内部で開いて印刷する。

import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hasSelfReportAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";
import { isUndiagnosedPlaceholderUser } from "@/lib/placeholder-user";
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
  type DetailedReport,
  type ReportSection,
} from "@/lib/detailed-report-content";
import { buildKoDetailedReport } from "@/i18n/ko/detailed-report";
import { KO_RESULT_TYPES } from "@/i18n/ko/result";
import { ReportPrintButton } from "@/components/report/ReportPrintButton";
import { ReportCover } from "@/components/report/ReportCover";
import styles from "./page.module.css";

export async function generateMetadata({
  searchParams,
}: Pick<PageProps, "searchParams">): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: {
      absolute:
        sp.locale === "ko"
          ? "완전판 리포트 | 나의 사용설명서"
          : "詳細レポート | ワタシのトリセツ",
    },
  };
}

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type ReportUserRow = {
  id: string;
  scores: Partial<Record<BigFiveDimension, number>> | null;
  display_name: string | null;
  diagnosis_completed_at: string | null;
};

type ScoreMeta = {
  key: BigFiveDimension;
  label: string;
  low: string;
  high: string;
};

const SCORE_META: ScoreMeta[] = [
  {
    key: "O",
    label: "新しい体験へのひらかれ",
    low: "慣れ親しんだものを大切にする",
    high: "新しい世界を楽しむ",
  },
  {
    key: "C",
    label: "ものごとの進め方",
    low: "流れに合わせて柔軟に進む",
    high: "計画を立てて着実に進む",
  },
  {
    key: "E",
    label: "エネルギーの向かう先",
    low: "ひとりの時間で整える",
    high: "人との時間で活気づく",
  },
  {
    key: "A",
    label: "人との向き合い方",
    low: "率直さと合理性を重んじる",
    high: "調和と思いやりを重んじる",
  },
  {
    key: "N",
    label: "刺激への敏感さ",
    low: "落ち着いて受け止める",
    high: "細かな変化を感じ取る",
  },
];

const KO_SCORE_META: ScoreMeta[] = [
  {
    key: "O",
    label: "새로운 경험에 대한 개방성",
    low: "익숙한 것을 소중히 해요",
    high: "새로운 세계를 즐겨요",
  },
  {
    key: "C",
    label: "일을 진행하는 방식",
    low: "흐름에 맞춰 유연하게 움직여요",
    high: "계획을 세워 꾸준히 나아가요",
  },
  {
    key: "E",
    label: "에너지가 향하는 곳",
    low: "혼자만의 시간으로 충전해요",
    high: "사람과 함께할 때 활기를 얻어요",
  },
  {
    key: "A",
    label: "사람을 대하는 방식",
    low: "솔직함과 합리성을 중시해요",
    high: "조화와 배려를 중시해요",
  },
  {
    key: "N",
    label: "자극에 대한 민감성",
    low: "차분하게 받아들여요",
    high: "작은 변화도 섬세하게 느껴요",
  },
];

const OCEAN: readonly BigFiveDimension[] = ["O", "C", "E", "A", "N"];

const PREVIEW_SCORES: Partial<Record<BigFiveDimension, number>> = {
  O: 8.4,
  C: 6.2,
  E: 3.7,
  A: 8.8,
  N: 7.9,
};

const CHAPTER_SCENES: Partial<
  Record<number, "normal1" | "normal2" | "love" | "school" | "work">
> = {
  0: "normal1",
  2: "love",
  3: "normal2",
  4: "school",
  5: "work",
  7: "normal2",
};

const KO_STORY_PAGE_COUNT = 15;
const KO_STORY_TITLES = [
  "아직 이름 없는 힘",
  "첫 번째 신호",
  "곁에 남는 법",
  "문 너머로",
  "퍼져 가는 평판",
  "역할의 무게",
  "흐려지는 풍경",
  "폭풍이 지나가는 밤",
  "나를 발견해 주는 사람들",
  "약함에 이름 붙이기",
  "새로운 약속",
  "힘을 나누는 법",
  "아침의 풍경",
  "나의 이야기로",
  "빛은 계속된다",
] as const;
const KO_STORY_THEMES = [
  "night",
  "aqua",
  "paper",
  "gold",
  "aqua",
  "paper",
  "dusk",
  "storm",
  "dawn",
  "paper",
  "aqua",
  "gold",
  "dawn",
  "paper",
  "night",
] as const;
const KO_STORY_ART = [
  "portrait",
  "normal1",
  "normal2",
  "love",
  "school",
  "work",
  "normal2",
  "moshimo",
  "normal1",
  "normal2",
  "work",
  "school",
  "love",
  "normal1",
  "portrait",
] as const;

type KoStoryAtom = {
  context: string;
  heading: string;
  body: string;
  quote?: boolean;
};

type KoStoryPage = {
  title: string;
  atoms: KoStoryAtom[];
};

function koStoryAtoms(report: DetailedReport): KoStoryAtom[] {
  const atoms: KoStoryAtom[] = [];

  for (const chapter of report.chapters) {
    for (const section of chapter.sections) {
      if (section.quote) {
        atoms.push({
          context: chapter.title,
          heading: section.heading ?? chapter.title,
          body: section.quote,
          quote: true,
        });
      }

      if (section.body) {
        for (const [paragraphIndex, paragraph] of section.body
          .split("\n\n")
          .entries()) {
          if (!paragraph.trim()) continue;
          atoms.push({
            context: chapter.title,
            heading:
              paragraphIndex === 0
                ? section.heading ?? chapter.title
                : chapter.title,
            body: paragraph,
          });
        }
      }

      for (const bullet of section.bullets ?? []) {
        atoms.push({
          context: chapter.title,
          heading: bullet.title,
          body: bullet.body,
        });
      }
    }
  }

  return atoms;
}

/**
 * 日本版の「表紙1ページ + 本文15ページ」と同じ配布単位へ整える。
 * 韓国語では縦書きが自然ではないため横書きを維持し、本文を順序どおり15章へ
 * 均等配分する。内容は省略せず、ページごとの文字量だけを揃える。
 */
function buildKoStoryPages(report: DetailedReport): KoStoryPage[] {
  const atoms = koStoryAtoms(report);
  while (atoms.length < KO_STORY_PAGE_COUNT) {
    atoms.push({
      context: "마무리",
      heading: "다시 펼쳐 볼 문장",
      body: "성격은 정답이 아니라 나를 오래 이해하기 위한 지도예요. 오늘의 나에게 맞는 문장을 천천히 골라 보세요.",
    });
  }

  const weights = atoms.map(
    (atom) => atom.heading.length + atom.body.length + 24,
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const pages: KoStoryPage[] = [];
  let cursor = 0;
  let consumedWeight = 0;

  for (let pageIndex = 0; pageIndex < KO_STORY_PAGE_COUNT; pageIndex += 1) {
    const pageAtoms: KoStoryAtom[] = [];
    const pagesAfter = KO_STORY_PAGE_COUNT - pageIndex - 1;
    const targetWeight =
      (totalWeight * (pageIndex + 1)) / KO_STORY_PAGE_COUNT;

    while (cursor < atoms.length) {
      const atomsAfterCurrent = atoms.length - cursor - 1;
      const mustLeaveOnePerPage = atomsAfterCurrent < pagesAfter;
      if (pageAtoms.length > 0 && (consumedWeight >= targetWeight || mustLeaveOnePerPage)) {
        break;
      }

      pageAtoms.push(atoms[cursor]);
      consumedWeight += weights[cursor];
      cursor += 1;
    }

    pages.push({
      title: KO_STORY_TITLES[pageIndex],
      atoms: pageAtoms,
    });
  }

  // 重い最後のatomなどで端数が出た場合も、本文を捨てず最終章へ収める。
  if (cursor < atoms.length) {
    pages[pages.length - 1].atoms.push(...atoms.slice(cursor));
  }

  return pages;
}

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp = await searchParams;
  const isKo = sp.locale === "ko";

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
    displayName = isKo ? "미리보기" : "プレビュー";
    scores = PREVIEW_SCORES;
  } else {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, scores, display_name, diagnosis_completed_at")
      .eq("owner_token", token)
      .maybeSingle();
    if (error) {
      console.error("[/report/[token]/print] users lookup error:", error);
    }
    const user = data as ReportUserRow | null;
    if (!user) {
      notFound();
    }

    if (isUndiagnosedPlaceholderUser(user)) {
      const current = await getSession();
      const prefix = isKo ? "/ko" : "";
      redirect(
        current?.id === user.id ? `${prefix}/diagnosis` : `${prefix}/login`,
      );
    }

    const paid = await hasSelfReportAccess(user.id);
    if (!paid) {
      return <LockedScreen token={token} isKo={isKo} />;
    }

    scores = user.scores ?? {};
    t32 = classifyThirtyTwoType(scores);
    displayName = user.display_name;
  }

  const report = isKo
    ? buildKoDetailedReport(t32, scores)
    : detailedReportFor(t32);
  if (!report) {
    console.error(`[/report/[token]/print] missing report content for ${t32}`);
    notFound();
  }

  const koType = isKo ? KO_RESULT_TYPES[t32] : null;
  const name = koType?.name ?? thirtyTwoName(t32);
  const essence = koType?.essence ?? thirtyTwoEssence(t32);
  const catchphrase = koType?.oneLiner ?? thirtyTwoCatchphrase(t32);
  const color = thirtyTwoColor(t32);
  const group = thirtyTwoGroup(t32);
  const { heroBg: coverBackground, codeTint: coverAccent } =
    heroColorsForGroup(group);
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
    <main
      className={`${styles.reportRoot} ${isKo ? styles.reportRootKo : ""}`}
      style={reportStyle}
    >
      <div className={styles.screenToolbar}>
        <p>{isKo ? "완전판 PDF 미리보기" : "自己分析PDF プレビュー"}</p>
        <ReportPrintButton locale={isKo ? "ko" : "ja"} />
      </div>

      <article className={styles.reportDocument}>
        <ReportCover
          locale={isKo ? "ko" : "ja"}
          profileLabel={isKo ? "PERSONALITY STORY" : "PERSONALITY PROFILE"}
          imageSrc={cutImagePath}
          imageAlt={name}
          characterName={name}
          title={essence}
          subtitle={isKo ? "나의 성격 스토리" : "パーソナリティプロフィール"}
          metric={<CoverOcean scores={scores} isKo={isKo} />}
          quote={isKo ? `‘${catchphrase}’` : `「${catchphrase}」`}
          readerLabel={
            isKo
              ? greeting
                ? `${greeting}님의 리포트`
                : "나의 리포트"
              : greeting
                ? `${greeting}さんのレポート`
                : "あなたのレポート"
          }
          reportLabel={isKo ? "16-PAGE STORY REPORT" : "SELF-DISCOVERY REPORT"}
          fullBleed
        />

        {isKo ? (
          <KoreanStoryPages
            report={report}
            essence={essence}
            characterName={name}
            characterImagePath={cutImagePath}
            characterGroup={group}
          />
        ) : (
          <>
        <section className={styles.overviewPage}>
          <p className={styles.pageEyebrow}>YOUR PROFILE</p>
          <h2 className={styles.overviewTitle}>
            {isKo ? "이 리포트를 읽는 방법" : "このレポートの読み方"}
          </h2>
          <p className={styles.leadText}>
            {isKo ? (
              <>
                이 한 권은 자기 진단에서 나타난 다섯 가지 경향과, 그 결과로
                도출된 <strong>{name}</strong>의 모습을 함께 읽어 낸 리포트예요.
                어떤 경향에도 좋고 나쁨은 없어요. 지금의 나와 맞는 부분을 단서
                삼아 나다운 선택과 사람들과의 편안한 거리를 찾아보세요.
              </>
            ) : (
              <>
                この一冊は、自己診断で表れた5つの傾向と、そこから導かれた
                <strong>{name}</strong>の人物像を重ねて読み解いたものです。
                どの傾向にも良し悪しはありません。今の自分に当てはまるところを手がかりに、
                自分らしい選び方や、人との心地よい距離を見つけてください。
              </>
            )}
          </p>

          <div className={styles.profileStatement}>
            <p>{isKo ? `${essence} 유형의 핵심` : `${essence}型の核`}</p>
            <strong>{catchphrase}</strong>
          </div>

          <div className={styles.scoreSection}>
            <div className={styles.sectionHeadingRow}>
              <h3>{isKo ? "5가지 성격 경향" : "5つの傾向"}</h3>
              <span>
                {isKo ? "자기 진단 점수 / 10" : "自己診断スコア / 10"}
              </span>
            </div>
            <div className={styles.scoreList}>
              {(isKo ? KO_SCORE_META : SCORE_META).map((meta) => (
                <ScoreRow
                  key={meta.key}
                  meta={meta}
                  value={scores[meta.key]}
                  isKo={isKo}
                />
              ))}
            </div>
          </div>

          <nav className={styles.contents} aria-label={isKo ? "목차" : "目次"}>
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
          const scenePath = scene
            ? `/characters/scenes/${group}_${scene}.webp`
            : null;

          return (
            <section
              key={chapter.title}
              className={`${styles.chapter} ${index === 2 ? styles.flowChapter : ""}`}
            >
              <header className={styles.chapterHeader}>
                <p className={styles.chapterNumber}>
                  CHAPTER {String(index + 1).padStart(2, "0")}
                </p>
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
          <h2>
            {isKo ? "마음이 흔들릴 때마다, 다시." : "迷ったときに、何度でも。"}
          </h2>
          <p>
            {isKo
              ? "성격은 나를 단정 짓는 답이 아니라, 나를 이해하기 위한 지도예요. 상황과 경험에 따라 느끼는 방식이 달라졌을 때 이 리포트를 다시 열어 보세요."
              : "性格は、決めつけるための答えではなく、自分を理解するための地図です。状況や経験によって感じ方が変わったときは、またこのレポートを開いてください。"}
          </p>
          <div className={styles.endMark}>
            {isKo ? "나의 사용설명서" : "ワタシのトリセツ"}
          </div>
          <Link
            href={`${isKo ? "/ko" : ""}/me/${encodeURIComponent(previewType ? "preview" : token)}`}
            className={styles.backLink}
          >
            {isKo ? "완성된 자기 진단 결과 보기" : "埋まった自己診断結果を見る"}
          </Link>
        </footer>
          </>
        )}
      </article>
    </main>
  );
}

function KoreanStoryPages({
  report,
  essence,
  characterName,
  characterImagePath,
  characterGroup,
}: {
  report: DetailedReport;
  essence: string;
  characterName: string;
  characterImagePath: string;
  characterGroup: ReturnType<typeof thirtyTwoGroup>;
}) {
  const pages = buildKoStoryPages(report);
  const themeClasses = {
    aqua: styles.koStoryAqua,
    dawn: styles.koStoryDawn,
    dusk: styles.koStoryDusk,
    gold: styles.koStoryGold,
    night: styles.koStoryNight,
    paper: styles.koStoryPaper,
    storm: styles.koStoryStorm,
  } as const;

  return (
    <>
      {pages.map((page, pageIndex) => {
        const charCount = page.atoms.reduce(
          (sum, atom) => sum + atom.heading.length + atom.body.length,
          0,
        );
        const densityClass =
          charCount > 1100
            ? styles.koStoryPageExtraDense
            : charCount > 820
              ? styles.koStoryPageDense
              : "";
        const chapterLabel =
          pageIndex === 0
            ? "서장"
            : pageIndex === KO_STORY_PAGE_COUNT - 1
              ? "여운"
              : `제${pageIndex}장`;
        const art = KO_STORY_ART[pageIndex];
        const artPath =
          art === "portrait"
            ? characterImagePath
            : `/characters/scenes/${characterGroup}_${art}.webp`;

        return (
          <section
            key={page.title}
            className={`${styles.koStoryPage} ${themeClasses[KO_STORY_THEMES[pageIndex]]} ${densityClass}`}
          >
            <Image
              src={artPath}
              alt=""
              fill
              className={`${styles.koStoryArt} ${art === "portrait" ? styles.koStoryPortraitArt : ""}`}
              loading="eager"
              sizes="210mm"
            />

            <div className={styles.koStoryFrame}>
              <header className={styles.koStoryHeader}>
                <p>{chapterLabel}</p>
                <h2>{page.title}</h2>
                <span aria-hidden="true" />
              </header>

              <div className={styles.koStoryBody}>
                {page.atoms.map((atom, atomIndex) => (
                  <section
                    key={`${atom.context}-${atom.heading}-${atomIndex}`}
                    className={styles.koStoryAtom}
                  >
                    {atomIndex === 0 || atom.heading !== atom.context ? (
                      <h3>{atom.heading}</h3>
                    ) : null}
                    {atom.quote ? (
                      <blockquote>{atom.body}</blockquote>
                    ) : (
                      <p>{atom.body}</p>
                    )}
                  </section>
                ))}
              </div>
            </div>

            <footer className={styles.koStoryFooter}>
              <span>나의 사용설명서 · {essence}의 스토리</span>
              <span>
                {characterName} · {String(pageIndex + 2).padStart(2, "0")}
              </span>
            </footer>
          </section>
        );
      })}
    </>
  );
}

function CoverOcean({
  scores,
  isKo,
}: {
  scores: Partial<Record<BigFiveDimension, number>>;
  isKo: boolean;
}) {
  const code = OCEAN.map((key) =>
    (scores[key] ?? 5) >= 5 ? key : key.toLowerCase(),
  ).join("");

  return (
    <div
      className={styles.coverOcean}
      aria-label={isKo ? `OCEAN 코드 ${code}` : `OCEANコード ${code}`}
    >
      {OCEAN.map((key) => {
        const high = (scores[key] ?? 5) >= 5;

        return (
          <span
            key={key}
            className={high ? styles.coverOceanHigh : styles.coverOceanLow}
          >
            {high ? key : key.toLowerCase()}
          </span>
        );
      })}
    </div>
  );
}

function ScoreRow({
  meta,
  value,
  isKo,
}: {
  meta: ScoreMeta;
  value: number | undefined;
  isKo: boolean;
}) {
  const normalized = Math.max(
    0,
    Math.min(10, typeof value === "number" ? value : 5),
  );
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
        {isKo
          ? `${leaning} (${normalized.toFixed(1)} / 10)`
          : `${leaning}（${normalized.toFixed(1)} / 10）`}
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
    <div
      className={`${styles.sectionBlock} ${isFirst ? styles.firstSection : ""}`}
    >
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

function LockedScreen({ token, isKo }: { token: string; isKo: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-5 text-[#2A2520]">
      <div className="w-full max-w-md rounded-3xl border border-[#E8E1D5] bg-white px-8 py-10 text-center">
        <p className="mb-6 text-[11px] tracking-[0.25em] text-[#A89E8E]">
          WATASHI NO TORISETSU
        </p>
        <h1 className="mb-4 text-xl font-bold">
          {isKo ? (
            <>
              상세 리포트는
              <br />
              완전판 패키지에 포함돼요
            </>
          ) : (
            <>
              詳細レポートは
              <br />
              全解放プランの特典です
            </>
          )}
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-[#6B6359]">
          {isKo
            ? "내 유형의 강점과 주의점, 연애와 친구 관계, 커리어까지 한 권에 담은 상세 리포트예요. 완전판 패키지를 구매하면 이메일과 결과 페이지에서 다운로드할 수 있어요."
            : "あなたのタイプの長所と短所、恋愛・友人関係、キャリアまでを一冊にまとめた長編レポート。全解放プランを購入すると、メールでお届けします。"}
        </p>
        <Link
          href={`${isKo ? "/ko" : ""}/me/${encodeURIComponent(token)}`}
          className="inline-block rounded-full bg-[#2A2520] px-8 py-3 text-sm font-semibold text-[#FAF7F2]"
        >
          {isKo ? "내 결과에서 자세히 보기" : "マイ図鑑で詳しく見る"}
        </Link>
      </div>
    </main>
  );
}
