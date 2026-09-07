import type { ResultLocale } from "@/i18n/result";
import { KO_SELF_RESULT_CONTENT_32 } from "@/i18n/ko/me-content-32";
import type { BigFiveScores } from "@/lib/perception-analysis";
import { buildDeepDive } from "@/lib/tako-deepdive";
import {
  classifyThirtyTwoType,
  selfContentFor,
} from "@/lib/thirty-two-types";
import { BigFiveDivergingBars } from "./BigFiveDivergingBars";

const COPY = {
  ja: {
    titleLead: "あなたから見た",
    titleTail: "の性格傾向",
    gapLead: "一番のギャップは",
    selfLead: "自身は",
    answerLead: "あなたは",
    answerTail: "に感じてる。",
    primaryLabel: "あなたの目",
    selfLabelTail: "の自己診断",
  },
  ko: {
    titleLead: "당신이 보는 ",
    titleTail: "의 성격 경향",
    gapLead: "가장 큰 차이는 ",
    selfLead: " 본인은 ",
    answerLead: "당신은 ",
    answerTail: "로 느꼈어요.",
    primaryLabel: "당신의 시선",
    selfLabelTail: "의 자기 진단",
  },
} as const;

interface FriendGapSectionProps {
  selfScores: BigFiveScores;
  perceivedScores: BigFiveScores;
  targetLabel: string;
  locale?: ResultLocale;
}

function buildPerceivedProse(
  scores: BigFiveScores,
  targetLabel: string,
  locale: ResultLocale,
): string[] {
  const type32 = classifyThirtyTwoType(scores);
  const manual =
    locale === "ko"
      ? KO_SELF_RESULT_CONTENT_32[type32]?.[0]
      : selfContentFor(type32)[0];
  const paragraphs = (manual?.body ?? "").split("\n\n").filter(Boolean);
  const graphAfter = Math.max(0, Math.floor(paragraphs.length / 2) - 1);

  return paragraphs.slice(graphAfter + 1).map((paragraph, index) => {
    if (locale === "ko") {
      let text = paragraph;
      if (index === 0) {
        for (const connector of ["그리고, ", "그리고 ", "그리고", "게다가 ", "더욱이 "]) {
          if (text.startsWith(connector)) {
            text = text.slice(connector.length);
            break;
          }
        }
        if (text.startsWith("당신은")) {
          const rest = text
            .slice("당신은".length)
            .split("당신")
            .join(targetLabel);
          return `당신이 보는 ${targetLabel}은${rest}`;
        }
        return `당신이 보기에 ${text.split("당신").join(targetLabel)}`;
      }
      return text.split("당신").join(targetLabel);
    }

    let text = paragraph;
    if (index === 0) {
      for (const connector of ["そして、", "そして", "しかも", "さらに"]) {
        if (text.startsWith(connector)) {
          text = text.slice(connector.length);
          break;
        }
      }
      if (text.startsWith("あなたは")) {
        const rest = text
          .slice("あなたは".length)
          .split("あなた")
          .join(targetLabel);
        return `あなたから見た${targetLabel}は${rest}`;
      }
      return `あなたから見ると、${text.split("あなた").join(targetLabel)}`;
    }
    return text.split("あなた").join(targetLabel);
  });
}

export function FriendGapSection({
  selfScores,
  perceivedScores,
  targetLabel,
  locale = "ja",
}: FriendGapSectionProps) {
  const copy = COPY[locale];
  const deep = buildDeepDive(selfScores, perceivedScores, locale);
  const perceivedProse = buildPerceivedProse(
    perceivedScores,
    targetLabel,
    locale,
  );

  if (!deep) return null;

  return (
    <section className="mx-auto max-w-[1080px] pb-8 pt-12 md:pb-12 md:pt-16">
      <div className="mb-5 md:mb-7">
        <h2 className="text-[24px] font-black leading-[1.3] tracking-[-0.02em] text-[#2E2E5C] md:text-[36px]">
          {copy.titleLead}
          {targetLabel}
          {copy.titleTail}
        </h2>
      </div>

      <div className="mb-5 rounded-[22px] bg-[#F4F4FE] px-5 py-6 md:mb-7 md:rounded-[28px] md:px-8 md:py-8">
        <p className="text-[16px] font-black leading-[1.85] text-[#2E2E5C] md:text-[22px]">
          {copy.gapLead}
          {deep.gap.label}。{targetLabel}
          {copy.selfLead}
          <span className="text-[#5B5BEF]">{deep.gap.selfPercent}%</span>
          {locale === "ko" ? ", " : "、"}
          {copy.answerLead}
          <span className="text-[#5B5BEF]">{deep.gap.otherPercent}%</span>
          {copy.answerTail}
        </p>
      </div>

      <BigFiveDivergingBars
        scores={perceivedScores}
        friendScores={selfScores}
        primaryLabel={copy.primaryLabel}
        friendLabel={`${targetLabel}${copy.selfLabelTail}`}
        hideHeading
        locale={locale}
        className="mb-0"
      />

      {perceivedProse.length > 0 ? (
        <div className="mt-8 md:mt-10">
          {perceivedProse.map((paragraph) => (
            <p
              key={paragraph}
              className="body-gothic mb-6 text-[15px] font-normal leading-[1.9] text-[#1A1A1A] last:mb-0 md:text-[17px]"
            >
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
