import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportCover } from "@/components/report/ReportCover";
import { ReportPrintButton } from "@/components/report/ReportPrintButton";
import {
  buildEnDeepDiveSections,
  buildEnPartTwo,
  buildEnSelfSections,
  enDetailedProfile,
} from "@/i18n/en/me";
import { EN_RESULT_AXES, EN_RESULT_TYPES } from "@/i18n/en/result";
import { versionCharacterAssetPath } from "@/lib/character-image";
import { hasTakoAccess } from "@/lib/entitlements";
import { enFriendInsights } from "@/lib/en-friend-insights";
import { cardColorsForGroup, heroColorsForGroup } from "@/lib/hero-colors";
import {
  loadOwnerReportData,
  type FriendSummary,
  type OwnerReportData,
} from "@/lib/owner-report-data";
import { friendReportStoryImagePath } from "@/lib/report-story-images";
import { mockTakoData } from "@/lib/tako-mock";
import {
  classifyThirtyTwoType,
  thirtyTwoColor,
  thirtyTwoGroup,
  thirtyTwoImagePath,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";
import styles from "@/app/tako-report/[token]/print/page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Friend Analysis PDF | Alice Test",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ previewType?: string | string[] }>;
};
type Scores = Partial<Record<BigFiveDimension, number>>;
type Item = { title: string; body: string };

const axes = EN_RESULT_AXES;
const score = (scores: Scores, dim: BigFiveDimension) =>
  Math.max(0, Math.min(100, Math.round((scores[dim] ?? 5) * 10)));
const paras = (body: string) => body.split("\n\n").filter(Boolean);
const friendName = (friend: FriendSummary) =>
  friend.name.trim() && friend.name !== "ともだち"
    ? friend.name.trim()
    : "A friend";
const scene = (type: ThirtyTwoTypeId, kind: "normal1" | "normal2" | "love") =>
  versionCharacterAssetPath(
    `/characters/scenes/${thirtyTwoGroup(type)}_${kind}.webp`,
  );

function Paragraphs({ paragraphs }: { paragraphs: string[] }) {
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p className={styles.bodyParagraph} key={index}>
          {paragraph}
        </p>
      ))}
    </>
  );
}

function ChapterHeader({
  number,
  eyebrow,
  title,
}: {
  number: number;
  eyebrow: string;
  title: ReactNode;
}) {
  return (
    <header className={styles.chapterHeader}>
      <p className={styles.chapterNumber}>
        CHAPTER {String(number).padStart(2, "0")} / {eyebrow}
      </p>
      <h2>{title}</h2>
      <span className={styles.chapterRule} aria-hidden="true" />
    </header>
  );
}

function InsightList({
  items,
  tone = "positive",
}: {
  items: Item[];
  tone?: "positive" | "caution" | "love";
}) {
  return (
    <ul className={`${styles.insightList} ${styles[`insightList_${tone}`]}`}>
      {items.map((item, index) => (
        <li key={`${index}-${item.title}`}>
          <h4>
            <span aria-hidden="true" />
            {item.title}
          </h4>
          <p>{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

function ScoreRows({ self, other }: { self: Scores; other: Scores }) {
  return (
    <div className={styles.scoreList}>
      {axes.map((axis) => {
        const friendPercent = score(other, axis.dim);
        const selfPercent = score(self, axis.dim);
        return (
          <div className={styles.scoreRow} key={axis.dim}>
            <div className={styles.scoreCopy}>
              <div>
                <span className={styles.scoreKey}>{axis.dim}</span>
                <strong>{axis.title}</strong>
              </div>
              <span>
                {friendPercent >= 50
                  ? axis.highDescription
                  : axis.lowDescription}
              </span>
            </div>
            <div className={styles.comparisonTrack} aria-hidden="true">
              <span
                className={styles.friendBar}
                style={{ width: `${friendPercent}%` }}
              />
              <span
                className={styles.selfMarker}
                style={{ left: `calc(${selfPercent}% - 3px)` }}
              />
            </div>
            <p>
              Friend view {friendPercent}% / Self-view {selfPercent}%
            </p>
          </div>
        );
      })}
    </div>
  );
}

function FriendScoreRows({ self, other }: { self: Scores; other: Scores }) {
  return (
    <div className={styles.friendScoreList}>
      {axes.map((axis) => {
        const friendPercent = score(other, axis.dim);
        const selfPercent = score(self, axis.dim);
        return (
          <div className={styles.friendScoreRow} key={axis.dim}>
            <strong>{axis.title}</strong>
            <div className={styles.comparisonTrack} aria-hidden="true">
              <span
                className={styles.friendBar}
                style={{ width: `${friendPercent}%` }}
              />
              <span
                className={styles.selfMarker}
                style={{ left: `calc(${selfPercent}% - 3px)` }}
              />
            </div>
            <span>{friendPercent}%</span>
          </div>
        );
      })}
    </div>
  );
}

function gapItems(self: Scores, other: Scores): Item[] {
  return [...axes]
    .sort(
      (a, b) =>
        Math.abs(score(other, b.dim) - score(self, b.dim)) -
        Math.abs(score(other, a.dim) - score(self, a.dim)),
    )
    .slice(0, 4)
    .map((axis) => ({
      title: axis.title,
      body: `You scored yourself ${score(self, axis.dim)}%, while your friends scored you ${score(other, axis.dim)}%. ${score(other, axis.dim) >= 50 ? axis.highDescription : axis.lowDescription}`,
    }));
}

function guidance(
  self: Scores,
  other: Scores,
  name: string,
): { nurture: Item[]; traps: Item[] } {
  const nurture = axes.map((axis) => ({
    title: `Make room for ${axis.title.toLowerCase()}`,
    body: `On this dimension ${name} sees you at ${score(other, axis.dim)}% and you see yourself at ${score(self, axis.dim)}%. Compare one concrete situation before deciding what the difference means.`,
  }));
  nurture.push(
    {
      title: "Name what feels easy",
      body: "Tell each other which moments feel natural in this friendship. A shared language for comfort makes it easier to repeat those moments.",
    },
    {
      title: "Ask for an example",
      body: "Invite your friend to describe something they noticed rather than asking them to defend a score. Their example may reveal a strength you take for granted.",
    },
    {
      title: "Keep the view open",
      body: "Return to this conversation after a new experience. Both your self-view and a friend's view can change as your relationship grows.",
    },
  );
  const traps = axes.map((axis) => ({
    title: `Do not turn ${axis.title.toLowerCase()} into a label`,
    body: `A ${score(other, axis.dim)}% impression reflects what ${name} has seen in particular settings. Treating it as a fixed identity can hide the rest of your behavior.`,
  }));
  traps.push(
    {
      title: "Do not score the friendship",
      body: "Agreement measures how closely two descriptions align. It does not measure affection, trust, or how much either person cares.",
    },
    {
      title: "Avoid guessing motives",
      body: "If a comment surprises you, ask what happened in that moment. A guessed motive is usually less useful than the story behind it.",
    },
    {
      title: "Leave room for change",
      body: "An old impression can remain even after you have grown. Share what has changed without requiring your friend to notice it immediately.",
    },
  );
  return { nurture, traps };
}

function FriendChapter({
  data,
  friend,
  index,
}: {
  data: OwnerReportData;
  friend: FriendSummary;
  index: number;
}) {
  const name = friendName(friend);
  const typeId =
    friend.perceivedType32 ?? classifyThirtyTwoType(friend.perceivedScores);
  const type = EN_RESULT_TYPES[typeId];
  const self = buildEnSelfSections(typeId, friend.perceivedScores);
  const deep = buildEnDeepDiveSections(typeId, friend.perceivedScores, true);
  const part = buildEnPartTwo(typeId, friend.perceivedScores, true);
  const profile = enDetailedProfile(typeId);
  const insights = enFriendInsights(data.selfScores, friend);
  const love = deep.find((section) => section.key === "love")?.blocks ?? [];
  const attraction: Item[] = (part.weapons ?? []).slice(0, 6);
  const hints: Item[] = [
    { title: "Say what you need", body: profile.connection },
    { title: "Show care in your own rhythm", body: profile.love },
    ...axes.slice(0, 4).map((axis) => ({
      title: `Let ${axis.title.toLowerCase()} work for you`,
      body:
        score(friend.perceivedScores, axis.dim) >= 50
          ? axis.highDescription
          : axis.lowDescription,
    })),
  ];
  const quirks = paras(self[1].body);
  const { nurture, traps } = guidance(
    data.selfScores,
    friend.perceivedScores,
    name,
  );
  const imageSrc =
    friend.perceivedImageSrc ??
    versionCharacterAssetPath(thirtyTwoImagePath(typeId));

  return (
    <section className={`${styles.chapter} ${styles.friendChapter}`}>
      <ChapterHeader
        number={index + 2}
        eyebrow={`VOICE ${String(index + 1).padStart(2, "0")}`}
        title={
          <>
            How {name} sees
            <br />
            your personality
          </>
        }
      />

      <div className={styles.friendHero}>
        <Image
          src={imageSrc}
          alt={type.name}
          width={520}
          height={520}
          className={styles.friendHeroImage}
          loading="eager"
        />
        <div>
          <p>You through {name}&apos;s eyes</p>
          <h3>{type.essence}</h3>
          <span>{type.name}</span>
        </div>
      </div>

      <figure className={styles.sceneFigure}>
        <Image
          src={scene(typeId, "normal1")}
          alt=""
          width={1500}
          height={850}
          className={styles.sceneImage}
          loading="eager"
        />
      </figure>

      <div className={styles.sectionBlock}>
        <h3>How you look through this friend&apos;s eyes</h3>
        <Paragraphs paragraphs={paras(self[0].body)} />
      </div>

      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeadingRow}>
          <h3>The impression across five dimensions</h3>
          <span>● Friend view　◆ Self-view</span>
        </div>
        <blockquote className={styles.gapQuote}>
          The clearest difference is a matter of perspective, not a verdict:{" "}
          <strong>{insights.axis}</strong>
        </blockquote>
        <FriendScoreRows
          self={data.selfScores}
          other={friend.perceivedScores}
        />
      </div>

      <div className={styles.sectionBlock}>
        <p className={styles.sectionEyebrow}>LOVE &amp; ATTRACTION</p>
        <h3>The appeal {name} notices</h3>
        <figure className={styles.sceneFigure}>
          <Image
            src={scene(typeId, "love")}
            alt=""
            width={1500}
            height={850}
            className={styles.sceneImage}
            loading="eager"
          />
        </figure>
        <Paragraphs
          paragraphs={love
            .slice(0, 2)
            .flatMap((block) => paras(block.body))
            .slice(0, 5)}
        />
        <p className={styles.bodyParagraph}>{insights.love}</p>
        <h4 className={styles.subheading}>Hidden strengths in love</h4>
        <InsightList items={attraction} />
        <h4 className={styles.subheading}>Hints from {name}</h4>
        <InsightList items={hints} tone="love" />
      </div>

      <div className={`${styles.sectionBlock} ${styles.sectionBreak}`}>
        <p className={styles.sectionEyebrow}>BELOVED QUIRKS</p>
        <h3>The habits {name} may notice</h3>
        <Paragraphs paragraphs={quirks.slice(0, 4)} />
      </div>

      <div className={styles.sectionBlock}>
        <p className={styles.sectionEyebrow}>RELATIONSHIP GUIDE</p>
        <h3>Growing your friendship with {name}</h3>
        <figure className={styles.sceneFigure}>
          <Image
            src={scene(typeId, "normal2")}
            alt=""
            width={1500}
            height={850}
            className={styles.sceneImage}
            loading="eager"
          />
        </figure>
        <div className={styles.compatibilityStatement}>
          <span>Alignment between your perspectives</span>
          <strong>{friend.mutual}%</strong>
          <em>VIEW</em>
        </div>
        <Paragraphs paragraphs={[insights.compatibility, insights.care]} />
        <h4 className={styles.subheading}>Ways to nurture the connection</h4>
        <InsightList items={nurture} />
        <h4 className={styles.subheading}>Traps to avoid</h4>
        <InsightList items={traps} tone="caution" />
      </div>
    </section>
  );
}

export default async function EnglishFriendReportPrintPage({
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
  const data = previewType
    ? mockTakoData(previewType, "en")
    : await loadOwnerReportData(token);
  if (
    !data ||
    data.friends.length === 0 ||
    (!previewType && !(await hasTakoAccess(data.user.id)))
  ) {
    notFound();
  }

  const ownerName = data.user.display_name?.trim() || "you";
  const avg = data.friendAvgScores;
  if (!avg) notFound();
  const avgTypeId = classifyThirtyTwoType(avg);
  const avgType = EN_RESULT_TYPES[avgTypeId];
  const avgSelf = buildEnSelfSections(avgTypeId, avg);
  const avgPart = buildEnPartTwo(avgTypeId, avg, true);
  const messages = data.friends.filter((friend) => friend.message.trim());
  const contents = [
    "The group view",
    ...data.friends.map((friend) => `${friendName(friend)}'s perspective`),
    ...(messages.length ? ["Messages from friends"] : []),
    "Closing words",
  ];
  const color = thirtyTwoColor(avgTypeId);
  const group = thirtyTwoGroup(avgTypeId);
  const { heroBg: coverBackground, codeTint: coverAccent } =
    heroColorsForGroup(group);
  const { panelBg: coverSoft } = cardColorsForGroup(group);
  const reportStyle = {
    "--report-accent": color,
    "--report-accent-soft": `${color}2B`,
    "--report-accent-wash": `${color}12`,
    "--cover-background": coverBackground,
    "--cover-accent": coverAccent,
    "--cover-accent-soft": `${coverAccent}38`,
    "--cover-soft": coverSoft,
  } as CSSProperties;
  const coverImage =
    data.friendCharacter?.imageSrc ??
    data.friends[0].perceivedImageSrc ??
    scene(avgTypeId, "normal1");
  const generatedAt = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const rankedAvgAxes = [...axes].sort(
    (a, b) =>
      Math.abs(score(avg, b.dim) - score(data.selfScores, b.dim)) -
      Math.abs(score(avg, a.dim) - score(data.selfScores, a.dim)),
  );
  const avgAxisCards = [
    { label: "Biggest gap from your self-view", axis: rankedAvgAxes[0] },
    { label: "Closest shared view", axis: rankedAvgAxes.at(-1) },
    { label: "Another difference to explore", axis: rankedAvgAxes[1] },
  ];

  return (
    <main className={styles.reportRoot} style={reportStyle} lang="en">
      <div className={styles.screenToolbar}>
        <p>Friend analysis report preview</p>
        <ReportPrintButton locale="en" />
      </div>

      <article className={styles.reportDocument}>
        <ReportCover
          locale="en"
          profileLabel="SOCIAL MIRROR REPORT"
          imageSrc={coverImage}
          imageAlt={avgType.name}
          characterName={avgType.name}
          title={avgType.essence}
          subtitle="How your friends see you"
          quote={`A personal analysis shaped by ${data.friends.length} friend ${data.friends.length === 1 ? "perspective" : "perspectives"}.`}
          readerLabel={`${ownerName}'s report`}
          reportLabel="SOCIAL MIRROR REPORT"
          coverTitle="Through Your Friends' Eyes"
          storyTitle={`${avgType.name}'s Story`}
          storyImageSrc={friendReportStoryImagePath(coverImage) ?? undefined}
          fullBleed
        />

        <section className={styles.overviewPage}>
          <p className={styles.pageEyebrow}>ABOUT THIS REPORT</p>
          <h2 className={styles.overviewTitle}>
            How to read this social mirror
          </h2>
          <p className={styles.leadText}>
            This report places the person you recognize in yourself beside the
            person your friends notice. Agreement shows where your traits are
            easy to see. Differences can reveal a side that appears only in
            certain relationships. Neither is a better answer.
          </p>
          <div className={styles.profileStatement}>
            <p>A profile built from your friends&apos; voices</p>
            <strong>{avgType.essence}</strong>
            <span>
              {avgType.name} · {data.friends.length}{" "}
              {data.friends.length === 1 ? "perspective" : "perspectives"}
            </span>
          </div>
          <div className={styles.scoreSection}>
            <div className={styles.sectionHeadingRow}>
              <h3>Five-dimension comparison</h3>
              <span>● Friend view　◆ Self-view</span>
            </div>
            <ScoreRows self={data.selfScores} other={avg} />
          </div>
          <nav className={styles.contents} aria-label="Contents">
            <p className={styles.contentsLabel}>CONTENTS</p>
            <ol>
              {contents.map((item, index) => (
                <li key={`${index}-${item}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </nav>
        </section>

        <section className={styles.chapter}>
          <ChapterHeader
            number={1}
            eyebrow="SOCIAL MIRROR"
            title={
              <>
                The person your
                <br />
                friends see
              </>
            }
          />
          <figure className={styles.sceneFigure}>
            <Image
              src={scene(avgTypeId, "normal1")}
              alt=""
              width={1500}
              height={850}
              className={styles.sceneImage}
              loading="eager"
            />
          </figure>
          <div className={styles.profileStatement}>
            <p>When your friends&apos; voices come together</p>
            <strong>You appear as {avgType.essence}</strong>
            <span>{avgType.name}</span>
          </div>
          <div className={styles.sectionBlock}>
            <h3>Another side of you seen from outside</h3>
            <Paragraphs paragraphs={paras(avgSelf[0].body)} />
          </div>
          <div className={styles.axisInsightGrid}>
            {avgAxisCards.map(({ label, axis }) => {
              if (!axis) return null;
              const difference = Math.abs(
                score(avg, axis.dim) - score(data.selfScores, axis.dim),
              );
              return (
                <div className={styles.axisInsightCard} key={label}>
                  <p>{label}</p>
                  <strong>{axis.title}</strong>
                  <span>{difference} points apart</span>
                </div>
              );
            })}
          </div>
          <div className={styles.sectionBlock}>
            <h3>Where the views differ most</h3>
            <Paragraphs
              paragraphs={gapItems(data.selfScores, avg).map(
                (item) => `${item.title}: ${item.body}`,
              )}
            />
          </div>
          <div className={styles.sectionBlock}>
            <h3>Strengths visible from outside</h3>
            <InsightList items={(avgPart.weapons ?? []).slice(0, 4)} />
          </div>
          <div className={styles.sectionBlock}>
            <p className={styles.sectionEyebrow}>WHAT THEY NOTICE</p>
            <h3>Habits you may overlook</h3>
            <InsightList
              items={(avgPart.dislikable ?? []).slice(0, 4)}
              tone="caution"
            />
          </div>
        </section>

        {data.friends.map((friend, index) => (
          <FriendChapter
            data={data}
            friend={friend}
            index={index}
            key={friend.perceptionId}
          />
        ))}

        {messages.length > 0 ? (
          <section className={`${styles.chapter} ${styles.messageChapter}`}>
            <ChapterHeader
              number={data.friends.length + 2}
              eyebrow="LETTERS FROM FRIENDS"
              title="Messages in their own words"
            />
            <p className={styles.messageLead}>
              Numbers cannot hold everything a friend wants to say. Their
              messages are preserved here in full.
            </p>
            <div className={styles.messageList}>
              {messages.map((friend) => (
                <div className={styles.messageCard} key={friend.perceptionId}>
                  <Image
                    src={friend.perceivedImageSrc ?? coverImage}
                    alt=""
                    width={160}
                    height={160}
                    className={styles.messageFace}
                    loading="eager"
                  />
                  <div>
                    <p>{friendName(friend)}</p>
                    <blockquote>{friend.message}</blockquote>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <footer className={styles.endPage}>
          <p className={styles.pageEyebrow}>KEEP THIS CLOSE</p>
          <h2>When you need a fuller view of yourself.</h2>
          <p>
            Your friends may recognize strengths in actions that feel ordinary
            to you. When your own perspective feels too narrow, return to the
            eyes and words preserved in this report.
          </p>
          <div className={styles.endMark}>
            THEIR VIEW OF YOU
            <br />
            IS PART OF YOUR STORY
          </div>
          <p className={styles.generatedAt}>Issued {generatedAt}</p>
          <Link
            className={styles.backLink}
            href={`/en/tako/${encodeURIComponent(previewType ? "preview" : token)}`}
          >
            Back to friend results
          </Link>
        </footer>
      </article>
    </main>
  );
}
