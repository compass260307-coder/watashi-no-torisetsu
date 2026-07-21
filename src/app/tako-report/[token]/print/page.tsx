// PDF生成専用の「友達診断 完全版レポート」描画ページ: /tako-report/[token]/print
//
// 自己診断の完全版レポートと同じ紙面品質を基準に、
// 巻頭の総合分析 + 友達ごとの証言編 + メッセージ集で構成する。
// 認可: token (owner_token) + hasTakoAccess。未購入は本文を組み立てない。

import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReportPrintButton } from "@/components/report/ReportPrintButton";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hasTakoAccess } from "@/lib/entitlements";
import {
  loadOwnerReportData,
  type OwnerReportData,
} from "@/lib/owner-report-data";
import { mockTakoData } from "@/lib/tako-mock";
import {
  buildTakoReportOverview,
  buildTakoReportSheets,
  type TakoReportOverview,
  type TakoReportOverviewAxis,
  type TakoReportSheet,
} from "@/lib/tako-report-sheets";
import { baseIdOf, type ThirtyTwoTypeId } from "@/lib/thirty-two-types";
import { sixteenTypes } from "@/lib/sixteen-types";
import { cardColorsForGroup, heroColorsForGroup } from "@/lib/hero-colors";
import type { BigFiveDimension } from "@/lib/types";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "友達診断 完全版レポート | ワタシのトリセツ",
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const AXIS_SHORT: Record<BigFiveDimension, string> = {
  O: "開放性",
  C: "誠実性",
  E: "外向性",
  A: "協調性",
  N: "敏感さ",
};

function Paragraphs({ paragraphs }: { paragraphs: string[] }) {
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className={styles.bodyParagraph}>
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
  items: { title: string; body: string }[];
  tone?: "positive" | "caution" | "love";
}) {
  return (
    <ul className={`${styles.insightList} ${styles[`insightList_${tone}`]}`}>
      {items.map((item) => (
        <li key={item.title}>
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

function ComparisonRows({
  axes,
}: {
  axes: TakoReportOverviewAxis[];
}) {
  return (
    <div className={styles.scoreList}>
      {axes.map((axis) => (
        <div key={axis.key} className={styles.scoreRow}>
          <div className={styles.scoreCopy}>
            <div>
              <span className={styles.scoreKey}>{axis.key}</span>
              <strong>{axis.label}</strong>
            </div>
            <span>{axis.friendLeaning}</span>
          </div>
          <div className={styles.comparisonTrack} aria-hidden="true">
            <span
              className={styles.friendBar}
              style={{ width: `${axis.friendPercent}%` }}
            />
            <span
              className={styles.selfMarker}
              style={{ left: `calc(${axis.selfPercent}% - 3px)` }}
            />
          </div>
          <p>
            友達の目 {axis.friendPercent}% / 自己認識 {axis.selfPercent}%
          </p>
        </div>
      ))}
    </div>
  );
}

function FriendScoreRows({
  sheet,
  selfScores,
}: {
  sheet: TakoReportSheet;
  selfScores: Partial<Record<BigFiveDimension, number>>;
}) {
  const axes = (["O", "C", "E", "A", "N"] as BigFiveDimension[]).map(
    (key) => {
      const friendPercent = Math.max(
        0,
        Math.min(100, Math.round((sheet.scores[key] ?? 5) * 10)),
      );
      const selfPercent = Math.max(
        0,
        Math.min(100, Math.round((selfScores[key] ?? 5) * 10)),
      );
      return { key, friendPercent, selfPercent };
    },
  );

  return (
    <div className={styles.friendScoreList}>
      {axes.map((axis) => (
        <div key={axis.key} className={styles.friendScoreRow}>
          <strong>{AXIS_SHORT[axis.key]}</strong>
          <div className={styles.comparisonTrack} aria-hidden="true">
            <span
              className={styles.friendBar}
              style={{ width: `${axis.friendPercent}%` }}
            />
            <span
              className={styles.selfMarker}
              style={{ left: `calc(${axis.selfPercent}% - 3px)` }}
            />
          </div>
          <span>{axis.friendPercent}%</span>
        </div>
      ))}
    </div>
  );
}

function AxisInsightCard({
  label,
  axis,
  children,
}: {
  label: string;
  axis: TakoReportOverviewAxis;
  children: ReactNode;
}) {
  return (
    <div className={styles.axisInsightCard}>
      <p>{label}</p>
      <strong>{AXIS_SHORT[axis.key]}</strong>
      <span>{children}</span>
    </div>
  );
}

function FriendChapter({
  sheet,
  index,
  chapterNumber,
  selfScores,
}: {
  sheet: TakoReportSheet;
  index: number;
  chapterNumber: number;
  selfScores: Partial<Record<BigFiveDimension, number>>;
}) {
  const normalScene = `/characters/scenes/${sheet.group}_normal1.webp`;
  const loveScene = `/characters/scenes/${sheet.group}_love.webp`;
  const relationScene = `/characters/scenes/${sheet.group}_normal2.webp`;

  return (
    <section className={`${styles.chapter} ${styles.friendChapter}`}>
      <ChapterHeader
        number={chapterNumber}
        eyebrow={`VOICE ${String(index + 1).padStart(2, "0")}`}
        title={
          <>
            {sheet.viewer}から見た
            <br />
            あなたのプロフィール
          </>
        }
      />

      <div className={styles.friendHero}>
        <Image
          src={sheet.imageSrc}
          alt={sheet.charName}
          width={520}
          height={520}
          className={styles.friendHeroImage}
          loading="eager"
        />
        <div>
          <p>{sheet.viewer}の目に映るあなた</p>
          <h3>{sheet.essence}</h3>
          <span>{sheet.charName}タイプ</span>
        </div>
      </div>

      <figure className={styles.sceneFigure}>
        <Image
          src={normalScene}
          alt=""
          width={1500}
          height={850}
          className={styles.sceneImage}
          loading="eager"
        />
      </figure>

      <div className={styles.sectionBlock}>
        <h3>この友達には、あなたがこう見えている</h3>
        <Paragraphs paragraphs={sheet.manualParas} />
      </div>

      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeadingRow}>
          <h3>5つの傾向に表れた「見え方」</h3>
          <span>● 友達の目　◆ 自己認識</span>
        </div>
        {sheet.deep ? (
          <blockquote className={styles.gapQuote}>
            一番のギャップは<strong>{sheet.deep.gap.label}</strong>。
            自分では{sheet.deep.gap.selfPercent}%、{sheet.viewer}は
            {sheet.deep.gap.otherPercent}%感じています。
          </blockquote>
        ) : null}
        <FriendScoreRows sheet={sheet} selfScores={selfScores} />
      </div>

      <div className={styles.sectionBlock}>
        <p className={styles.sectionEyebrow}>LOVE &amp; ATTRACTION</p>
        <h3>{sheet.viewer}から見た、恋愛での魅力</h3>
        <figure className={styles.sceneFigure}>
          <Image
            src={loveScene}
            alt=""
            width={1500}
            height={850}
            className={styles.sceneImage}
            loading="eager"
          />
        </figure>
        <Paragraphs paragraphs={sheet.loveParas} />
        <h4 className={styles.subheading}>隠れモテポイント</h4>
        <InsightList items={sheet.loveChecks} />
        <h4 className={styles.subheading}>{sheet.viewer}からのヒント</h4>
        <InsightList items={sheet.loveHints} tone="love" />
      </div>

      <div className={`${styles.sectionBlock} ${styles.sectionBreak}`}>
        <p className={styles.sectionEyebrow}>BELOVED QUIRKS</p>
        <h3>{sheet.viewer}が気づいている、愛されるクセ</h3>
        <Paragraphs paragraphs={sheet.kuseParas} />
      </div>

      {sheet.compat ? (
        <div className={styles.sectionBlock}>
          <p className={styles.sectionEyebrow}>RELATIONSHIP GUIDE</p>
          <h3>{sheet.viewer}との関係の育て方</h3>
          <figure className={styles.sceneFigure}>
            <Image
              src={relationScene}
              alt=""
              width={1500}
              height={850}
              className={styles.sceneImage}
              loading="eager"
            />
          </figure>
          <div className={styles.compatibilityStatement}>
            <span>見方から読み解く相性</span>
            <strong>{sheet.compat.percent}%</strong>
            <em>ランク {sheet.compat.rank}</em>
          </div>
          <Paragraphs paragraphs={sheet.compat.summaryParas} />
          <h4 className={styles.subheading}>関係を深めるヒント</h4>
          <InsightList items={sheet.compat.kotsu} />
          <h4 className={styles.subheading}>関係を壊すワナ</h4>
          <InsightList items={sheet.compat.wana} tone="caution" />
        </div>
      ) : null}
    </section>
  );
}

function OverviewChapter({ overview }: { overview: TakoReportOverview }) {
  const scenePath = `/characters/scenes/${overview.group}_normal1.webp`;

  return (
    <section className={styles.chapter}>
      <ChapterHeader
        number={1}
        eyebrow="SOCIAL MIRROR"
        title={
          <>
            みんなの目に映る
            <br />
            あなたの全体像
          </>
        }
      />

      <figure className={styles.sceneFigure}>
        <Image
          src={scenePath}
          alt=""
          width={1500}
          height={850}
          className={styles.sceneImage}
          loading="eager"
        />
      </figure>

      <div className={styles.profileStatement}>
        <p>{overview.friendCount}人の友達の声を重ねると</p>
        <strong>「{overview.essence}」として映っています</strong>
        <span>{overview.charName}タイプ</span>
      </div>

      <div className={styles.sectionBlock}>
        <h3>外側から見えている、もう一人のあなた</h3>
        <Paragraphs paragraphs={overview.profileParas} />
      </div>

      <div className={styles.axisInsightGrid}>
        <AxisInsightCard label="自分との最大ギャップ" axis={overview.biggestGap}>
          {overview.biggestGap.diffPoints}ポイントの違い
        </AxisInsightCard>
        {overview.mostSharedAxis ? (
          <AxisInsightCard label="友達の見方が揃った面" axis={overview.mostSharedAxis}>
            誰といるときにも伝わりやすい個性
          </AxisInsightCard>
        ) : null}
        {overview.mostVariedAxis ? (
          <AxisInsightCard label="相手によって印象が変わる面" axis={overview.mostVariedAxis}>
            関係や場面で出し方が変わる個性
          </AxisInsightCard>
        ) : null}
      </div>

      <div className={styles.sectionBlock}>
        <h3>自己認識と、みんなの目の間にあるもの</h3>
        <Paragraphs paragraphs={overview.gapParas} />
      </div>

      {overview.strengths.length > 0 ? (
        <div className={styles.sectionBlock}>
          <p className={styles.sectionEyebrow}>STRENGTHS THEY SEE</p>
          <h3>友達の目が知っている、あなたの強み</h3>
          <InsightList items={overview.strengths} />
        </div>
      ) : null}

      {overview.surprises.length > 0 ? (
        <div className={styles.sectionBlock}>
          <p className={styles.sectionEyebrow}>WHAT THEY NOTICE</p>
          <h3>自分では見落としやすい、愛されるクセ</h3>
          <InsightList items={overview.surprises} tone="caution" />
        </div>
      ) : null}
    </section>
  );
}

export default async function TakoReportPrintPage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const sp = await searchParams;

  const rawPreview = typeof sp.previewType === "string" ? sp.previewType : "";
  const isPreview =
    process.env.NODE_ENV !== "production" &&
    /^[a-z-]+__[NR]$/.test(rawPreview) &&
    Boolean(sixteenTypes[baseIdOf(rawPreview as ThirtyTwoTypeId)]);

  let data: OwnerReportData | null;
  if (isPreview) {
    data = mockTakoData(rawPreview as ThirtyTwoTypeId);
  } else {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("owner_token", token)
      .maybeSingle();
    if (!user) notFound();
    if (!(await hasTakoAccess(user.id as string))) {
      redirect(`/tako/${encodeURIComponent(token)}`);
    }
    data = await loadOwnerReportData(token);
  }
  if (!data || data.friends.length === 0) notFound();

  const overview = buildTakoReportOverview(data);
  if (!overview) notFound();

  const sheets = buildTakoReportSheets(data);
  const ownerName = (data.user.display_name ?? "").trim();
  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  });
  const withMessages = sheets.filter((sheet) => sheet.message.length > 0);
  const { heroBg: coverBackground, codeTint: coverAccent } =
    heroColorsForGroup(overview.group);
  const { panelBg: coverSoft } = cardColorsForGroup(overview.group);
  const reportStyle = {
    "--report-accent": coverAccent,
    "--report-accent-soft": `${coverAccent}2B`,
    "--report-accent-wash": `${coverAccent}12`,
    "--cover-background": coverBackground,
    "--cover-accent": coverAccent,
    "--cover-accent-soft": `${coverAccent}38`,
    "--cover-soft": coverSoft,
  } as CSSProperties;

  const contents = [
    "みんなの目に映る、あなたの全体像",
    ...sheets.map((sheet) => `${sheet.viewer}から見たあなた`),
    ...(withMessages.length > 0 ? ["友達からのメッセージ"] : []),
    "終わりに",
  ];

  return (
    <main className={styles.reportRoot} style={reportStyle}>
      <div className={styles.screenToolbar}>
        <p>友達診断 完全版PDF プレビュー</p>
        <ReportPrintButton />
      </div>

      <article className={styles.reportDocument}>
        <header className={styles.cover}>
          <div className={styles.coverOrbOne} aria-hidden="true" />
          <div className={styles.coverOrbTwo} aria-hidden="true" />
          <p className={styles.coverBrand}>WATASHI NO TORISETSU</p>
          <p className={styles.coverLabel}>SOCIAL MIRROR PROFILE</p>

          <div className={styles.coverVisual}>
            <Image
              src={overview.imageSrc}
              alt={overview.charName}
              width={900}
              height={900}
              className={styles.coverImage}
              priority
            />
          </div>

          <div className={styles.coverCopy}>
            <p className={styles.coverEssence}>{overview.charName}</p>
            <h1 className={styles.coverTitle}>{overview.essence}</h1>
            <p className={styles.coverSubtitle}>友達の目に映る、あなたのプロフィール</p>
            <p className={styles.coverQuote}>
              自分では見えない魅力を、{overview.friendCount}人の友達の視点から読み解く一冊。
            </p>
          </div>

          <div className={styles.coverFooter}>
            <span>{ownerName ? `${ownerName}さんのレポート` : "あなたのレポート"}</span>
            <span>SOCIAL MIRROR REPORT</span>
          </div>
        </header>

        <section className={styles.overviewPage}>
          <p className={styles.pageEyebrow}>ABOUT THIS REPORT</p>
          <h2 className={styles.overviewTitle}>このレポートの読み方</h2>
          <p className={styles.leadText}>
            この一冊は、自己診断で見えたあなたと、友達の目に映ったあなたを重ねて読み解いたものです。
            一致は「あなたらしさが伝わっている部分」、ギャップは「他者だから見つけられた新しい一面」。
            どちらも正解や優劣ではなく、関係をより心地よくするための手がかりとして読んでください。
          </p>

          <div className={styles.profileStatement}>
            <p>友達の声から生まれた、外側のプロフィール</p>
            <strong>{overview.essence}</strong>
            <span>{overview.charName}タイプ / 見方の一致 {overview.agreement}%</span>
          </div>

          <div className={styles.scoreSection}>
            <div className={styles.sectionHeadingRow}>
              <h3>5つの傾向の比較</h3>
              <span>● 友達の目　◆ 自己認識</span>
            </div>
            <ComparisonRows axes={overview.axes} />
          </div>

          <nav className={styles.contents} aria-label="目次">
            <p className={styles.contentsLabel}>CONTENTS</p>
            <ol>
              {contents.map((title, index) => (
                <li key={`${index}-${title}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{title}</span>
                </li>
              ))}
            </ol>
          </nav>
        </section>

        <OverviewChapter overview={overview} />

        {sheets.map((sheet, index) => (
          <FriendChapter
            key={`${sheet.name}-${index}`}
            sheet={sheet}
            index={index}
            chapterNumber={index + 2}
            selfScores={data.selfScores}
          />
        ))}

        {withMessages.length > 0 ? (
          <section className={`${styles.chapter} ${styles.messageChapter}`}>
            <ChapterHeader
              number={sheets.length + 2}
              eyebrow="LETTERS FROM FRIENDS"
              title="友達からのメッセージ"
            />
            <p className={styles.messageLead}>
              診断の数字だけでは拾いきれない、友達の言葉そのものを残します。
            </p>
            <div className={styles.messageList}>
              {withMessages.map((sheet, index) => (
                <div key={`${sheet.name}-${index}`} className={styles.messageCard}>
                  <Image
                    src={sheet.faceSrc}
                    alt=""
                    width={160}
                    height={160}
                    className={styles.messageFace}
                    loading="eager"
                  />
                  <div>
                    <p>{sheet.name}</p>
                    <blockquote>{sheet.message}</blockquote>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <footer className={styles.endPage}>
          <p className={styles.pageEyebrow}>KEEP THIS CLOSE</p>
          <h2>自分を見失いそうなときに。</h2>
          <p>
            あなたが当たり前にしていることを、友達はあなたの魅力として受け取っています。
            自分だけの視点では分からなくなったときは、このレポートに残った友達の目と言葉を、もう一度開いてみてください。
          </p>
          <div className={styles.endMark}>
            友達の目に映る
            <br />
            あなたも、あなたらしさの一部
          </div>
          <p className={styles.generatedAt}>{generatedAt} 発行</p>
          <Link
            href={`/tako/${encodeURIComponent(isPreview ? "preview" : token)}`}
            className={styles.backLink}
          >
            友達診断結果に戻る
          </Link>
        </footer>
      </article>
    </main>
  );
}
