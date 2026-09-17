import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportCover } from "@/components/report/ReportCover";
import { ReportPrintButton } from "@/components/report/ReportPrintButton";
import {
  buildEnDeepDiveSections,
  buildEnMoshimoScenes,
  buildEnPartTwo,
  buildEnSelfSections,
  enDetailedProfile,
  enScenarioLines,
} from "@/i18n/en/me";
import { EN_RESULT_AXES, EN_RESULT_TYPES } from "@/i18n/en/result";
import { versionCharacterAssetPath } from "@/lib/character-image";
import { hasSelfReportAccess } from "@/lib/entitlements";
import { cardColorsForGroup, heroColorsForGroup } from "@/lib/hero-colors";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  classifyThirtyTwoType,
  thirtyTwoColor,
  thirtyTwoGroup,
  thirtyTwoImagePath,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";
import styles from "@/app/report/[token]/print/page.module.css";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ previewType?: string | string[] }>;
};
type Scores = Partial<Record<BigFiveDimension, number>>;
type ChapterSection = { heading: string; body: string };
type Chapter = { title: string; sections: ChapterSection[] };

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

function join(items: string[]) {
  return items.filter(Boolean).join("\n\n");
}

function contentItems(
  items: { title: string; body: string }[] | null | undefined,
) {
  return (items ?? []).map((item) => `${item.title}: ${item.body}`);
}

function ScoreRows({ scores }: { scores: Scores }) {
  return (
    <div className={styles.scoreList}>
      {EN_RESULT_AXES.map((axis) => {
        const normalized = Math.max(0, Math.min(10, scores[axis.dim] ?? 5));
        const value = Math.round(normalized * 10);
        return (
          <div className={styles.scoreRow} key={axis.dim}>
            <div className={styles.scoreCopy}>
              <div>
                <span className={styles.scoreKey}>{axis.dim}</span>
                <strong>{axis.title}</strong>
              </div>
              <span>
                {value >= 50 ? axis.highDescription : axis.lowDescription}
              </span>
            </div>
            <div className={styles.scoreTrack} aria-hidden="true">
              <span style={{ width: `${value}%`, background: axis.color }} />
            </div>
            <p>{value}%</p>
          </div>
        );
      })}
    </div>
  );
}

export default async function EnglishReportPrintPage({
  params,
  searchParams,
}: Props) {
  const { token } = await params;
  const query = await searchParams;
  const rawPreview =
    typeof query.previewType === "string" ? query.previewType : "";
  const previewType =
    process.env.NODE_ENV !== "production" &&
    Object.hasOwn(EN_RESULT_TYPES, rawPreview)
      ? (rawPreview as ThirtyTwoTypeId)
      : null;
  const { data: storedUser } = previewType
    ? { data: null }
    : await supabaseAdmin
        .from("users")
        .select("id, display_name, scores, diagnosis_completed_at")
        .eq("owner_token", token)
        .maybeSingle();
  if (
    !previewType &&
    (!storedUser?.diagnosis_completed_at ||
      !(await hasSelfReportAccess(storedUser.id)))
  ) {
    notFound();
  }

  const data = previewType
    ? { display_name: "Preview", scores: { O: 8, C: 7, E: 5, A: 8, N: 6 } }
    : storedUser;
  if (!data) notFound();

  const scores = (data.scores ?? {}) as Scores;
  const typeId = previewType ?? classifyThirtyTwoType(scores);
  const type = EN_RESULT_TYPES[typeId];
  const profile = enDetailedProfile(typeId);
  const scenarios = enScenarioLines(scores);
  const selfSections = buildEnSelfSections(typeId, scores);
  const deepDive = buildEnDeepDiveSections(typeId, scores, true);
  const partTwo = buildEnPartTwo(typeId, scores, true);
  const moments = buildEnMoshimoScenes(scores, true);
  const loveBlocks =
    deepDive.find((section) => section.key === "love")?.blocks ?? [];
  const careerBlocks =
    deepDive.find((section) => section.key === "career")?.blocks ?? [];
  const family =
    (partTwo.relations ?? []).find((item) => item.relation === "With family")
      ?.body ?? profile.connection;
  const familyCaution =
    (partTwo.sceneCautions ?? []).find((item) => item.scene === "With family")
      ?.body ?? profile.temperamentGrowth;
  const parenting = [
    `As a parent or steady adult in a child's life, you are likely to offer care through the same qualities that shape your closest relationships. ${family}`,
    (scores.A ?? 5) >= 5
      ? "You tend to notice feelings quickly and may work hard to keep the atmosphere gentle. Children also benefit when you let them meet manageable frustration instead of smoothing every difficulty away."
      : "You tend to respect independence and may teach through honesty and practical consequences. Children also need warmth stated plainly, especially when your guidance feels obvious to you.",
    (scores.C ?? 5) >= 5
      ? "Routines, promises, and clear expectations can become a reliable source of safety. Leave some room for play and changing needs so structure remains supportive rather than rigid."
      : "You can make family life flexible, playful, and responsive to the moment. A few dependable routines help children know what will happen even when the rest of the day stays open.",
    familyCaution,
  ];

  const chapters: Chapter[] = [
    {
      title: "Introduction",
      sections: [
        { heading: "Your core pattern", body: selfSections[0].body },
        {
          heading: "Your temperament",
          body: join([
            profile.temperamentCore,
            ...EN_RESULT_AXES.map((axis) =>
              (scores[axis.dim] ?? 5) >= 5
                ? axis.highDescription
                : axis.lowDescription,
            ),
          ]),
        },
      ],
    },
    {
      title: "Strengths and weaknesses",
      sections: [
        {
          heading: "Your signature strengths",
          body: join(contentItems(partTwo.weapons?.slice(0, 3))),
        },
        {
          heading: "Strengths to use",
          body: join([
            profile.temperamentStrength,
            ...contentItems(partTwo.weapons?.slice(3)),
          ]),
        },
        {
          heading: "Patterns to watch",
          body: join(contentItems(partTwo.dislikable?.slice(0, 2))),
        },
      ],
    },
    {
      title: "Love and romance",
      sections: [
        {
          heading: "How you tend to love",
          body: loveBlocks[0]?.body ?? profile.love,
        },
        {
          heading: "What you need in closeness",
          body: loveBlocks[1]?.body ?? profile.connection,
        },
        {
          heading: "Trust and repair",
          body: loveBlocks[2]?.body ?? profile.temperamentGrowth,
        },
        {
          heading: "What to watch in romance",
          body: join([
            loveBlocks[3]?.body ?? profile.caution,
            ...(partTwo.sceneCautions ?? [])
              .filter((item) => item.scene === "With a partner")
              .map((item) => item.body),
          ]),
        },
      ],
    },
    {
      title: "Friendship",
      sections: [
        {
          heading: "The connections you build",
          body: profile.connection,
        },
        {
          heading: "How you show up with friends",
          body: join(
            (partTwo.relations ?? [])
              .filter((item) => item.relation === "With friends")
              .map((item) => item.body),
          ),
        },
        {
          heading: "What friends may value in you",
          body: profile.strength,
        },
        {
          heading: "What to watch in friendship",
          body: join(
            (partTwo.sceneCautions ?? [])
              .filter((item) => item.scene === "With friends")
              .map((item) => item.body),
          ),
        },
      ],
    },
    {
      title: "Parenting",
      sections: [
        {
          heading: "How you guide and care",
          body: join(parenting.slice(0, 2)),
        },
        {
          heading: "Structure, freedom, and growth",
          body: join(parenting.slice(2)),
        },
      ],
    },
    {
      title: "Career path",
      sections: [
        {
          heading: "Work and purpose",
          body: careerBlocks[0]?.body ?? profile.core,
        },
        {
          heading: "The environment where you thrive",
          body: careerBlocks[1]?.body ?? profile.temperamentStrength,
        },
        {
          heading: "How you contribute",
          body: careerBlocks[2]?.body ?? profile.strength,
        },
        {
          heading: "A direction for growth",
          body: careerBlocks[3]?.body ?? profile.growth,
        },
      ],
    },
    {
      title: "Workplace patterns",
      sections: [
        {
          heading: "Relationships at work",
          body: join(
            (partTwo.relations ?? [])
              .filter((item) => item.relation === "At work")
              .map((item) => item.body),
          ),
        },
        {
          heading: "Pressure points",
          body: join(
            (partTwo.sceneCautions ?? [])
              .filter((item) => item.scene === "In your career")
              .map((item) => item.body),
          ),
        },
        {
          heading: "Patterns that can get in your way",
          body: join(contentItems(partTwo.dislikable?.slice(2))),
        },
        {
          heading: "Your growth theme",
          body: profile.temperamentGrowth,
        },
        {
          heading: "Your next edge",
          body: profile.growth,
        },
      ],
    },
    {
      title: "Summary",
      sections: [
        {
          heading: "Your patterns and a practical way forward",
          body: join([
            ...scenarios,
            profile.core,
            profile.strength,
            profile.caution,
            profile.growth,
            ...moments.map((item) => `${item.title}: ${item.body}`),
          ]),
        },
      ],
    },
  ];

  const color = thirtyTwoColor(typeId);
  const group = thirtyTwoGroup(typeId);
  const { heroBg: coverBackground, codeTint: coverAccent } =
    heroColorsForGroup(group);
  const { panelBg: coverSoft } = cardColorsForGroup(group);
  const imagePath = thirtyTwoImagePath(typeId);
  const cutImagePath = versionCharacterAssetPath(
    imagePath.replace("/characters/v3/", "/characters/cut/"),
  );
  const reportStyle = {
    "--report-accent": color,
    "--report-accent-soft": `${color}2B`,
    "--report-accent-wash": `${color}12`,
    "--cover-background": coverBackground,
    "--cover-accent": coverAccent,
    "--cover-accent-soft": `${coverAccent}38`,
    "--cover-soft": coverSoft,
  } as CSSProperties;
  const reader = data.display_name?.trim() || "you";

  return (
    <main className={styles.reportRoot} style={reportStyle} lang="en">
      <div className={styles.screenToolbar}>
        <p>Personality report preview</p>
        <ReportPrintButton locale="en" />
      </div>

      <article className={styles.reportDocument}>
        <ReportCover
          locale="en"
          profileLabel="PERSONALITY PROFILE"
          imageSrc={cutImagePath}
          imageAlt={type.name}
          characterName={type.name}
          title={type.essence}
          subtitle="Personality profile"
          quote={`“${type.oneLiner}”`}
          readerLabel={`${reader}'s report`}
          reportLabel="SELF-DISCOVERY REPORT"
          coverTitle="My Personality Manual"
          storyTitle={`${type.name}'s Story`}
          fullBleed
        />

        <section className={styles.overviewPage}>
          <p className={styles.pageEyebrow}>YOUR PROFILE</p>
          <h2 className={styles.overviewTitle}>How to read this report</h2>
          <p className={styles.leadText}>
            This report brings together your five personality dimensions and the
            character pattern they form: <strong>{type.name}</strong>. No
            tendency is inherently good or bad. Use the parts that feel true
            today to understand your choices and find a level of closeness that
            feels right in your relationships.
          </p>
          <div className={styles.profileStatement}>
            <p>The core of the {type.essence} pattern</p>
            <strong>{type.oneLiner}</strong>
          </div>
          <div className={styles.scoreSection}>
            <div className={styles.sectionHeadingRow}>
              <h3>Your five dimensions</h3>
              <span>Self-assessment score / 100</span>
            </div>
            <ScoreRows scores={scores} />
          </div>
          <nav className={styles.contents} aria-label="Contents">
            <p className={styles.contentsLabel}>CONTENTS</p>
            <ol>
              {chapters.map((chapter, index) => (
                <li key={chapter.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{chapter.title}</span>
                </li>
              ))}
            </ol>
          </nav>
        </section>

        {chapters.map((chapter, index) => {
          const sceneVariant = CHAPTER_SCENES[index];
          const scenePath = sceneVariant
            ? versionCharacterAssetPath(
                `/characters/scenes/${group}_${sceneVariant}.webp`,
              )
            : null;
          return (
            <section
              className={`${styles.chapter} ${index === 2 ? styles.flowChapter : ""}`}
              key={chapter.title}
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
                  <div
                    className={`${styles.sectionBlock} ${
                      sectionIndex === 0 ? styles.firstSection : ""
                    }`}
                    key={section.heading}
                  >
                    <h3>{section.heading}</h3>
                    {section.body
                      .split("\n\n")
                      .map((paragraph, paragraphIndex) => (
                        <p
                          className={styles.bodyParagraph}
                          key={paragraphIndex}
                        >
                          {paragraph}
                        </p>
                      ))}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <footer className={styles.endPage}>
          <p className={styles.pageEyebrow}>KEEP THIS CLOSE</p>
          <h2>Return whenever you need your bearings.</h2>
          <p>
            Personality is a map for understanding yourself, not a verdict that
            defines you. Open this report again when a new situation or
            experience changes what you notice.
          </p>
          <div className={styles.endMark}>MY PERSONALITY MANUAL</div>
          <Link
            className={styles.backLink}
            href={`/en/me/${encodeURIComponent(previewType ? "preview" : token)}`}
          >
            View my complete result
          </Link>
        </footer>
      </article>
      <style>{`@media print {
        .${styles.chapterHeader} { margin-bottom: 6mm; }
        .${styles.sceneFigure} { height: 52mm; margin-bottom: 6mm; }
        .${styles.sceneImage} { height: 52mm !important; max-height: 52mm !important; }
        .${styles.sectionBlock} { margin-bottom: 7mm; }
        .${styles.sectionBlock} h3 { margin-bottom: 3mm; font-size: 16px; line-height: 1.45; }
        .${styles.bodyParagraph} { margin-bottom: 3mm; font-size: 12px; line-height: 1.7; }
      }`}</style>
    </main>
  );
}
