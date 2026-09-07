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
import { ReportCover } from "@/components/report/ReportCover";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hasTakoAccess } from "@/lib/entitlements";
import { friendReportStoryImagePath } from "@/lib/report-story-images";
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

export async function generateMetadata({
  searchParams,
}: Pick<PageProps, "searchParams">): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: {
      absolute:
        sp.locale === "ko"
          ? "친구 진단 완전판 리포트 | 나의 사용설명서"
          : "友達診断 完全版レポート | ワタシのトリセツ",
    },
  };
}

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

const KO_AXIS_SHORT: Record<BigFiveDimension, string> = {
  O: "개방성",
  C: "성실성",
  E: "외향성",
  A: "우호성",
  N: "민감성",
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
  isKo,
}: {
  axes: TakoReportOverviewAxis[];
  isKo: boolean;
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
            {isKo ? "친구의 시선" : "友達の目"} {axis.friendPercent}% /{" "}
            {isKo ? "자기 인식" : "自己認識"} {axis.selfPercent}%
          </p>
        </div>
      ))}
    </div>
  );
}

function FriendScoreRows({
  sheet,
  selfScores,
  isKo,
}: {
  sheet: TakoReportSheet;
  selfScores: Partial<Record<BigFiveDimension, number>>;
  isKo: boolean;
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
          <strong>{isKo ? KO_AXIS_SHORT[axis.key] : AXIS_SHORT[axis.key]}</strong>
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
  isKo,
}: {
  label: string;
  axis: TakoReportOverviewAxis;
  children: ReactNode;
  isKo: boolean;
}) {
  return (
    <div className={styles.axisInsightCard}>
      <p>{label}</p>
      <strong>{isKo ? KO_AXIS_SHORT[axis.key] : AXIS_SHORT[axis.key]}</strong>
      <span>{children}</span>
    </div>
  );
}

function FriendChapter({
  sheet,
  index,
  chapterNumber,
  selfScores,
  isKo,
}: {
  sheet: TakoReportSheet;
  index: number;
  chapterNumber: number;
  selfScores: Partial<Record<BigFiveDimension, number>>;
  isKo: boolean;
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
            {isKo ? `${sheet.viewer}의 눈에 비친` : `${sheet.viewer}から見た`}
            <br />
            {isKo ? "나의 프로필" : "あなたのプロフィール"}
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
          <p>
            {isKo
              ? `${sheet.viewer}의 눈에 비친 나`
              : `${sheet.viewer}の目に映るあなた`}
          </p>
          <h3>{sheet.essence}</h3>
          <span>{sheet.charName}{isKo ? " 유형" : "タイプ"}</span>
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
        <h3>
          {isKo
            ? "이 친구의 눈에는 내가 이렇게 보여요"
            : "この友達には、あなたがこう見えている"}
        </h3>
        <Paragraphs paragraphs={sheet.manualParas} />
      </div>

      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeadingRow}>
          <h3>{isKo ? "5가지 경향에 나타난 인상" : "5つの傾向に表れた「見え方」"}</h3>
          <span>{isKo ? "● 친구  ◆ 나" : "● 友達の目　◆ 自己認識"}</span>
        </div>
        {sheet.deep ? (
          <blockquote className={styles.gapQuote}>
            {isKo ? (
              <>
                가장 큰 차이는 <strong>{sheet.deep.gap.label}</strong>이에요.
                나는 {sheet.deep.gap.selfPercent}%라고 느끼고, {sheet.viewer}의
                눈에는 {sheet.deep.gap.otherPercent}%로 보여요.
              </>
            ) : (
              <>
                一番のギャップは<strong>{sheet.deep.gap.label}</strong>。
                自分では{sheet.deep.gap.selfPercent}%、{sheet.viewer}は
                {sheet.deep.gap.otherPercent}%感じています。
              </>
            )}
          </blockquote>
        ) : null}
        <FriendScoreRows sheet={sheet} selfScores={selfScores} isKo={isKo} />
      </div>

      <div className={styles.sectionBlock}>
        <p className={styles.sectionEyebrow}>LOVE &amp; ATTRACTION</p>
        <h3>
          {isKo
            ? `${sheet.viewer}의 눈에 비친 연애 매력`
            : `${sheet.viewer}から見た、恋愛での魅力`}
        </h3>
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
        <h4 className={styles.subheading}>
          {isKo ? "숨은 연애 매력" : "隠れモテポイント"}
        </h4>
        <InsightList items={sheet.loveChecks} />
        <h4 className={styles.subheading}>
          {isKo ? `${sheet.viewer}의 힌트` : `${sheet.viewer}からのヒント`}
        </h4>
        <InsightList items={sheet.loveHints} tone="love" />
      </div>

      <div className={`${styles.sectionBlock} ${styles.sectionBreak}`}>
        <p className={styles.sectionEyebrow}>BELOVED QUIRKS</p>
        <h3>
          {isKo
            ? `${sheet.viewer}의 눈에 보인 사랑받는 습관`
            : `${sheet.viewer}が気づいている、愛されるクセ`}
        </h3>
        <Paragraphs paragraphs={sheet.kuseParas} />
      </div>

      {sheet.compat ? (
        <div className={styles.sectionBlock}>
          <p className={styles.sectionEyebrow}>RELATIONSHIP GUIDE</p>
          <h3>
            {isKo
              ? `${sheet.viewer}과의 관계를 키우는 방법`
              : `${sheet.viewer}との関係の育て方`}
          </h3>
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
            <span>{isKo ? "서로의 관점으로 읽는 궁합" : "見方から読み解く相性"}</span>
            <strong>{sheet.compat.percent}%</strong>
            <em>{isKo ? "등급" : "ランク"} {sheet.compat.rank}</em>
          </div>
          <Paragraphs paragraphs={sheet.compat.summaryParas} />
          <h4 className={styles.subheading}>
            {isKo ? "관계를 깊게 만드는 힌트" : "関係を深めるヒント"}
          </h4>
          <InsightList items={sheet.compat.kotsu} />
          <h4 className={styles.subheading}>
            {isKo ? "관계를 멀어지게 하는 함정" : "関係を壊すワナ"}
          </h4>
          <InsightList items={sheet.compat.wana} tone="caution" />
        </div>
      ) : null}
    </section>
  );
}

function OverviewChapter({
  overview,
  isKo,
}: {
  overview: TakoReportOverview;
  isKo: boolean;
}) {
  const scenePath = `/characters/scenes/${overview.group}_normal1.webp`;

  return (
    <section className={styles.chapter}>
      <ChapterHeader
        number={1}
        eyebrow="SOCIAL MIRROR"
        title={
          <>
            {isKo ? "친구들의 눈에 비친" : "みんなの目に映る"}
            <br />
            {isKo ? "나의 전체 모습" : "あなたの全体像"}
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
        <p>
          {isKo
            ? `${overview.friendCount}명의 친구 목소리를 모으면`
            : `${overview.friendCount}人の友達の声を重ねると`}
        </p>
        <strong>
          {isKo
            ? `‘${overview.essence}’의 모습으로 보여요`
            : `「${overview.essence}」として映っています`}
        </strong>
        <span>{overview.charName}{isKo ? " 유형" : "タイプ"}</span>
      </div>

      <div className={styles.sectionBlock}>
        <h3>{isKo ? "밖에서 보이는 또 다른 나" : "外側から見えている、もう一人のあなた"}</h3>
        <Paragraphs paragraphs={overview.profileParas} />
      </div>

      <div className={styles.axisInsightGrid}>
        <AxisInsightCard
          label={isKo ? "나와 가장 큰 차이" : "自分との最大ギャップ"}
          axis={overview.biggestGap}
          isKo={isKo}
        >
          {overview.biggestGap.diffPoints}{isKo ? "포인트 차이" : "ポイントの違い"}
        </AxisInsightCard>
        {overview.mostSharedAxis ? (
          <AxisInsightCard
            label={isKo ? "친구들의 시선이 모인 면" : "友達の見方が揃った面"}
            axis={overview.mostSharedAxis}
            isKo={isKo}
          >
            {isKo ? "누구와 있어도 잘 전해지는 개성" : "誰といるときにも伝わりやすい個性"}
          </AxisInsightCard>
        ) : null}
        {overview.mostVariedAxis ? (
          <AxisInsightCard
            label={isKo ? "상대에 따라 인상이 달라지는 면" : "相手によって印象が変わる面"}
            axis={overview.mostVariedAxis}
            isKo={isKo}
          >
            {isKo ? "관계와 상황에 따라 다르게 드러나는 개성" : "関係や場面で出し方が変わる個性"}
          </AxisInsightCard>
        ) : null}
      </div>

      <div className={styles.sectionBlock}>
        <h3>{isKo ? "자기 인식과 친구들의 시선 사이" : "自己認識と、みんなの目の間にあるもの"}</h3>
        <Paragraphs paragraphs={overview.gapParas} />
      </div>

      {overview.strengths.length > 0 ? (
        <div className={styles.sectionBlock}>
          <p className={styles.sectionEyebrow}>STRENGTHS THEY SEE</p>
          <h3>{isKo ? "친구들의 눈이 알고 있는 나의 강점" : "友達の目が知っている、あなたの強み"}</h3>
          <InsightList items={overview.strengths} />
        </div>
      ) : null}

      {overview.surprises.length > 0 ? (
        <div className={styles.sectionBlock}>
          <p className={styles.sectionEyebrow}>WHAT THEY NOTICE</p>
          <h3>{isKo ? "스스로 놓치기 쉬운 사랑받는 습관" : "自分では見落としやすい、愛されるクセ"}</h3>
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
  const isKo = sp.locale === "ko";
  const locale = isKo ? "ko" : "ja";

  const rawPreview = typeof sp.previewType === "string" ? sp.previewType : "";
  const isPreview =
    process.env.NODE_ENV !== "production" &&
    /^[a-z-]+__[NR]$/.test(rawPreview) &&
    Boolean(sixteenTypes[baseIdOf(rawPreview as ThirtyTwoTypeId)]);

  let data: OwnerReportData | null;
  if (isPreview) {
    data = mockTakoData(rawPreview as ThirtyTwoTypeId, locale);
  } else {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("owner_token", token)
      .maybeSingle();
    if (!user) notFound();
    if (!(await hasTakoAccess(user.id as string))) {
      redirect(`${isKo ? "/ko" : ""}/tako/${encodeURIComponent(token)}`);
    }
    data = await loadOwnerReportData(token);
  }
  if (!data || data.friends.length === 0) notFound();

  const overview = buildTakoReportOverview(data, locale);
  if (!overview) notFound();

  const sheets = buildTakoReportSheets(data, locale);
  const ownerName =
    isKo && isPreview
      ? "미리보기"
      : (data.user.display_name ?? "").trim();
  const generatedAt = new Date().toLocaleDateString(isKo ? "ko-KR" : "ja-JP", {
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
    isKo ? "친구들의 눈에 비친 나의 전체 모습" : "みんなの目に映る、あなたの全体像",
    ...sheets.map((sheet) =>
      isKo ? `${sheet.viewer}의 눈에 비친 나` : `${sheet.viewer}から見たあなた`,
    ),
    ...(withMessages.length > 0
      ? [isKo ? "친구가 남긴 메시지" : "友達からのメッセージ"]
      : []),
    isKo ? "마무리" : "終わりに",
  ];

  return (
    <main
      className={`${styles.reportRoot} ${isKo ? styles.reportRootKo : ""}`}
      style={reportStyle}
    >
      <div className={styles.screenToolbar}>
        <p>{isKo ? "친구 진단 완전판 PDF 미리보기" : "友達診断 完全版PDF プレビュー"}</p>
        <ReportPrintButton locale={locale} />
      </div>

      <article className={styles.reportDocument}>
        <ReportCover
          locale={locale}
          profileLabel="SOCIAL MIRROR PROFILE"
          imageSrc={overview.imageSrc}
          imageAlt={overview.charName}
          characterName={overview.charName}
          title={overview.essence}
          coverTitle={isKo ? "친구들이 본 나" : "みんなから見た"}
          storyTitle={
            isKo
              ? `${overview.essence}의 이야기`
              : `${overview.essence}のストーリー`
          }
          storyImageSrc={
            friendReportStoryImagePath(overview.imageSrc) ?? undefined
          }
          subtitle={
            isKo ? "친구들의 눈에 비친 나의 프로필" : "友達の目に映る、あなたのプロフィール"
          }
          quote={
            isKo
              ? `혼자서는 보지 못한 매력을 ${overview.friendCount}명의 친구 시선으로 읽어 내는 한 권.`
              : `自分では見えない魅力を、${overview.friendCount}人の友達の視点から読み解く一冊。`
          }
          readerLabel={
            isKo
              ? ownerName
                ? `${ownerName}님의 리포트`
                : "나의 리포트"
              : ownerName
                ? `${ownerName}さんのレポート`
                : "あなたのレポート"
          }
          reportLabel="SOCIAL MIRROR REPORT"
          fullBleed
        />

        <section className={styles.overviewPage}>
          <p className={styles.pageEyebrow}>ABOUT THIS REPORT</p>
          <h2 className={styles.overviewTitle}>
            {isKo ? "이 리포트를 읽는 방법" : "このレポートの読み方"}
          </h2>
          <p className={styles.leadText}>
            {isKo
              ? "이 한 권은 자기 진단으로 본 나와 친구들의 눈에 비친 나를 겹쳐 읽어 낸 리포트예요. 일치는 ‘나다움이 그대로 전해진 부분’, 차이는 ‘다른 사람이기에 발견한 새로운 모습’이에요. 어느 쪽도 정답이나 우열이 아니라 관계를 더 편안하게 만드는 단서로 읽어 주세요."
              : "この一冊は、自己診断で見えたあなたと、友達の目に映ったあなたを重ねて読み解いたものです。一致は「あなたらしさが伝わっている部分」、ギャップは「他者だから見つけられた新しい一面」。どちらも正解や優劣ではなく、関係をより心地よくするための手がかりとして読んでください。"}
          </p>

          <div className={styles.profileStatement}>
            <p>{isKo ? "친구들의 목소리로 만든 밖에서 본 프로필" : "友達の声から生まれた、外側のプロフィール"}</p>
            <strong>{overview.essence}</strong>
            <span>
              {overview.charName}{isKo ? " 유형 / 관점 일치도 " : "タイプ / 見方の一致 "}
              {overview.agreement}%
            </span>
          </div>

          <div className={styles.scoreSection}>
            <div className={styles.sectionHeadingRow}>
              <h3>{isKo ? "5가지 성격 경향 비교" : "5つの傾向の比較"}</h3>
              <span>{isKo ? "● 친구  ◆ 나" : "● 友達の目　◆ 自己認識"}</span>
            </div>
            <ComparisonRows axes={overview.axes} isKo={isKo} />
          </div>

          <nav className={styles.contents} aria-label={isKo ? "목차" : "目次"}>
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

        <OverviewChapter overview={overview} isKo={isKo} />

        {sheets.map((sheet, index) => (
          <FriendChapter
            key={`${sheet.name}-${index}`}
            sheet={sheet}
            index={index}
            chapterNumber={index + 2}
            selfScores={data.selfScores}
            isKo={isKo}
          />
        ))}

        {withMessages.length > 0 ? (
          <section className={`${styles.chapter} ${styles.messageChapter}`}>
            <ChapterHeader
              number={sheets.length + 2}
              eyebrow="LETTERS FROM FRIENDS"
              title={isKo ? "친구가 남긴 메시지" : "友達からのメッセージ"}
            />
            <p className={styles.messageLead}>
              {isKo
                ? "진단의 숫자만으로는 담을 수 없는 친구의 말을 그대로 남겨요."
                : "診断の数字だけでは拾いきれない、友達の言葉そのものを残します。"}
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
          <h2>{isKo ? "내 모습을 잃어버릴 것 같은 순간에." : "自分を見失いそうなときに。"}</h2>
          <p>
            {isKo
              ? "내게는 당연한 행동을 친구들은 나만의 매력으로 받아들이고 있어요. 혼자 보는 시선만으로 나를 알기 어려운 순간에는 이 리포트에 남은 친구들의 눈과 말을 다시 열어 보세요."
              : "あなたが当たり前にしていることを、友達はあなたの魅力として受け取っています。自分だけの視点では分からなくなったときは、このレポートに残った友達の目と言葉を、もう一度開いてみてください。"}
          </p>
          <div className={styles.endMark}>
            {isKo ? "친구들의 눈에 비친" : "友達の目に映る"}
            <br />
            {isKo ? "나 역시 나다움의 일부" : "あなたも、あなたらしさの一部"}
          </div>
          <p className={styles.generatedAt}>
            {generatedAt} {isKo ? "발행" : "発行"}
          </p>
          <Link
            href={`${isKo ? "/ko" : ""}/tako/${encodeURIComponent(isPreview ? "preview" : token)}`}
            className={styles.backLink}
          >
            {isKo ? "친구 진단 결과로 돌아가기" : "友達診断結果に戻る"}
          </Link>
        </footer>
      </article>
    </main>
  );
}
