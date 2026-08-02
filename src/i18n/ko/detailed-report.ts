import { buildKoDeepDiveSections, buildKoPartTwo, buildKoSelfSections } from "@/i18n/ko/me";
import { KO_RESULT_AXES, KO_RESULT_TYPES } from "@/i18n/ko/result";
import type { DetailedReport, ReportBullet } from "@/lib/detailed-report-content";
import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

type Scores = Partial<Record<BigFiveDimension, number>>;

const OCEAN: readonly BigFiveDimension[] = ["O", "C", "E", "A", "N"];

const CARE_COPY: Record<
  BigFiveDimension,
  {
    high: ReportBullet;
    low: ReportBullet;
  }
> = {
  O: {
    high: {
      title: "호기심을 함께 키워 주세요",
      body: "새로운 질문과 관심사를 존중해 주면 스스로 생각하고 배우는 힘이 커져요. 정답을 바로 주기보다 함께 탐색하는 시간이 잘 맞아요.",
    },
    low: {
      title: "익숙한 리듬을 지켜 주세요",
      body: "예측할 수 있는 순서와 반복되는 일상에서 안정감을 만들어요. 변화가 필요할 때는 이유와 다음 단계를 미리 알려 주는 편이 좋아요.",
    },
  },
  C: {
    high: {
      title: "완벽보다 과정을 칭찬해 주세요",
      body: "책임감이 강한 만큼 작은 실수에도 스스로를 몰아붙일 수 있어요. 결과뿐 아니라 시도와 꾸준함을 구체적으로 알아봐 주세요.",
    },
    low: {
      title: "선택할 수 있는 구조를 만들어 주세요",
      body: "세세한 규칙보다 큰 기준과 마감이 있을 때 유연함이 살아나요. 두세 가지 선택지를 주면 자기 방식으로 끝까지 움직이기 쉬워요.",
    },
  },
  E: {
    high: {
      title: "함께 움직이며 에너지를 나눠 주세요",
      body: "대화와 활동 속에서 마음이 선명해져요. 충분히 표현하게 하되, 다른 사람의 속도를 기다리는 연습도 자연스럽게 알려 주세요.",
    },
    low: {
      title: "혼자 정리할 시간을 남겨 주세요",
      body: "바로 대답을 요구하기보다 생각을 모을 여백이 필요해요. 조용히 충전한 뒤에는 더 깊고 정확한 마음을 건넬 수 있어요.",
    },
  },
  A: {
    high: {
      title: "다정함과 자기 기준을 함께 지켜 주세요",
      body: "다른 사람의 마음을 먼저 살피다가 자신의 필요를 뒤로 미룰 수 있어요. 거절해도 관계가 깨지지 않는다는 경험이 큰 힘이 돼요.",
    },
    low: {
      title: "솔직함 뒤의 마음을 번역해 주세요",
      body: "사실과 원칙을 분명히 말하는 힘이 있어요. 무엇을 말할지와 함께 어떻게 들릴지도 살피면 신뢰와 배려를 함께 지킬 수 있어요.",
    },
  },
  N: {
    high: {
      title: "감정을 작게 나누어 말하게 해 주세요",
      body: "작은 변화도 깊게 느끼기 때문에 참다가 한꺼번에 지칠 수 있어요. 지금 느끼는 것을 짧게라도 말할 수 있는 안전한 분위기가 필요해요.",
    },
    low: {
      title: "차분함 속에서도 한 번 더 확인해 주세요",
      body: "예상 밖의 상황에서도 중심을 잘 지켜요. 다만 주변의 걱정을 너무 빨리 괜찮다고 정리하지 않도록 감정의 온도를 한 번 더 물어봐 주세요.",
    },
  },
};

function score(scores: Scores, dimension: BigFiveDimension): number {
  const value = scores[dimension];
  return typeof value === "number" ? value : 5;
}

function axisLabel(dimension: BigFiveDimension): string {
  return KO_RESULT_AXES.find((axis) => axis.dim === dimension)?.title ?? dimension;
}

function strongest(scores: Scores): BigFiveDimension[] {
  return [...OCEAN].sort(
    (left, right) =>
      Math.abs(score(scores, right) - 5) - Math.abs(score(scores, left) - 5),
  );
}

function careBullets(scores: Scores): ReportBullet[] {
  return strongest(scores).map((dimension) =>
    score(scores, dimension) >= 5
      ? CARE_COPY[dimension].high
      : CARE_COPY[dimension].low,
  );
}

function blocksToSections(
  blocks: { heading: string; body: string; locked?: boolean }[],
) {
  return blocks
    .filter((block) => !block.locked && block.body)
    .map((block) => ({ heading: block.heading, body: block.body }));
}

export function buildKoDetailedReport(
  typeId: ThirtyTwoTypeId,
  scores: Scores,
): DetailedReport {
  const type = KO_RESULT_TYPES[typeId];
  const selfSections = buildKoSelfSections(typeId, scores);
  const deepDive = buildKoDeepDiveSections(typeId, scores, true);
  const partTwo = buildKoPartTwo(typeId, scores, true);
  const love = deepDive.find((section) => section.key === "love");
  const career = deepDive.find((section) => section.key === "career");
  const strongestAxes = strongest(scores);
  const topAxis = strongestAxes[0];
  const secondAxis = strongestAxes[1];

  return {
    chapters: [
      {
        title: "시작하며",
        sections: [
          {
            heading: `${type.name}, 이런 사람이에요`,
            quote: type.oneLiner,
            body: selfSections[0]?.body,
          },
          {
            heading: "이 리포트를 읽는 방법",
            body: `이 리포트는 당신을 한 가지 틀에 가두기 위한 답이 아니에요. 지금의 자기 진단에서 드러난 다섯 가지 경향을 바탕으로, 자연스럽게 힘이 나는 순간과 조심해서 다루고 싶은 순간을 함께 살펴보는 안내서예요.\n\n특히 두드러진 경향은 ${axisLabel(topAxis)}과 ${axisLabel(secondAxis)}이에요. 맞는 문장은 오래 간직하고, 지금과 다른 문장은 앞으로 달라질 수 있는 여지로 가볍게 읽어 주세요.`,
          },
        ],
      },
      {
        title: "강점과 주의점",
        sections: [
          {
            heading: "당신이 이미 가지고 있는 무기",
            bullets: partTwo.weapons ?? [],
          },
          {
            heading: selfSections[1]?.heading ?? "장점이 너무 강해질 때",
            body: selfSections[1]?.body,
          },
          {
            heading: "가까운 사이에서 오해받기 쉬운 순간",
            bullets: partTwo.dislikable ?? [],
          },
        ],
      },
      {
        title: "연애 관계",
        sections: love ? blocksToSections(love.blocks ?? []) : [],
      },
      {
        title: "친구 관계",
        sections: [
          {
            heading: "친구가 좋아하는 당신의 모습",
            body: partTwo.likable.join("\n\n"),
          },
          {
            heading: "관계마다 다르게 보이는 나",
            bullets: (partTwo.relations ?? []).map((item) => ({
              title: item.relation,
              body: item.body,
            })),
          },
        ],
      },
      {
        title: "양육과 돌봄",
        sections: [
          {
            heading: "누군가의 성장을 곁에서 지켜볼 때",
            quote:
              "좋은 돌봄은 나와 같은 사람을 만드는 일이 아니라, 그 사람이 자기 리듬을 찾도록 곁을 지켜 주는 일이에요.",
            body: `${type.name} 유형은 자신이 중요하게 여기는 기준을 돌봄에도 자연스럽게 사용해요. 그래서 세심하게 챙기고 방향을 잡아 주는 힘이 있지만, 내가 편한 속도가 상대에게도 맞는지는 한 번 더 살펴볼 필요가 있어요.\n\n아이를 키우는 상황뿐 아니라 후배를 가르치거나 가족을 돌볼 때도 같아요. 대신 해 주는 것과 스스로 해 볼 기회를 주는 것 사이에서 균형을 찾으면, 당신의 강점은 통제가 아니라 든든한 지지가 돼요.`,
          },
          {
            heading: "당신다운 돌봄을 오래 이어 가는 법",
            bullets: careBullets(scores),
          },
        ],
      },
      {
        title: "커리어 경로",
        sections: career ? blocksToSections(career.blocks ?? []) : [],
      },
      {
        title: "일에서의 모습",
        sections: [
          {
            heading: "성과로 이어지는 자연스러운 방식",
            body: career?.body ?? undefined,
          },
          {
            heading: "장면별로 기억하고 싶은 주의점",
            bullets: (partTwo.sceneCautions ?? []).map((item) => ({
              title: item.scene,
              body: item.body,
            })),
          },
          {
            heading: "함께 일하는 사람에게 알려 주고 싶은 것",
            bullets: (partTwo.relations ?? [])
              .filter((item) => item.relation === "상사·선배에게")
              .map((item) => ({ title: item.relation, body: item.body })),
          },
        ],
      },
      {
        title: "마무리",
        sections: [
          {
            heading: `${type.essence}, 당신에게 남기고 싶은 말`,
            quote: type.oneLiner,
            body: `당신의 성격은 고쳐야 할 목록이 아니라 오래 잘 사용하기 위해 알아 두면 좋은 설명서예요. ${axisLabel(topAxis)}이 강하게 드러나는 날도, 평소와 다른 선택을 하는 날도 모두 당신 안에 있는 진짜 모습이에요.\n\n강점은 무리해서 증명하지 않아도 이미 관계와 일 속에서 쓰이고 있어요. 지칠 때는 더 잘하려 하기보다 어떤 신호를 놓치고 있는지 먼저 살펴보세요. 자신에게 맞는 속도와 거리를 되찾는 순간, 같은 성향은 다시 가장 든든한 힘이 돼요.\n\n이 리포트가 결정을 대신해 주지는 않아요. 다만 선택 앞에서 흔들릴 때, 내가 무엇을 중요하게 여기고 어떤 환경에서 자연스러웠는지를 떠올리게 해 줄 거예요. 필요할 때마다 다시 열어 보고, 지금의 나에게 맞는 문장을 새롭게 발견해 주세요.`,
          },
        ],
      },
    ],
  };
}
