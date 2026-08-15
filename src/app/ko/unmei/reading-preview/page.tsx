import { notFound } from "next/navigation";
import UnmeiReading from "@/components/uranai/UnmeiReading";
import type { Chart } from "@/lib/unmei/chart-view";

const PREVIEW_READING = {
  locale: "ko",
  hitokoto:
    "당신의 별은 다정함을 단순한 성격이 아니라 세상과 연결되는 방식으로 품고 있어요.",
  sections: [
    {
      id: "haichi",
      title: "당신이 쌓아 온 별의 배치",
      body: "태양은 무엇을 소중히 여기며 살아가는지 비춰 줘요. 성격 진단과 별의 배치가 서로 다른 길에서 같은 강점을 가리키고 있어요.",
    },
    {
      id: "kokoro",
      title: "마음의 날씨",
      body: "관계 속에서 작은 변화와 온도 차이를 섬세하게 알아차려요. 다른 사람에게 건네는 안심을 자신에게도 돌려주세요.",
    },
    {
      id: "chosen",
      title: "도전의 방향",
      body: "앞으로의 도전은 크게 보이는 것보다 내 기준으로 선택하는 일에서 시작돼요.",
    },
    {
      id: "grace",
      title: "마지막 한마디",
      body: "별이 보여 주는 것은 정해진 운명이 아니라, 지금까지의 선택을 이해하기 위한 지도예요.",
    },
  ],
};

const PREVIEW_CHART: Chart = {
  planets: {
    sun: { sign: "Leo", degree: 15.2 },
    moon: { sign: "Pisces", degree: 3.4 },
    mercury: { sign: "Virgo", degree: 2.8 },
    venus: { sign: "Gemini", degree: 28.5 },
    mars: { sign: "Virgo", degree: 10.1 },
    jupiter: { sign: "Virgo", degree: 25.9 },
    saturn: { sign: "Cancer", degree: 18.3 },
  },
  asc: { sign: "Scorpio", degree: 12 },
  mc: { sign: "Leo", degree: 22 },
  houses_available: true,
};

export default function KoreanUnmeiReadingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <UnmeiReading
      reading={PREVIEW_READING}
      chart={PREVIEW_CHART}
      essence="동행자"
      characterSlug="dolphin"
      identity={{
        typeName: "반짝 돌고래",
        catchphrase: "사람의 마음에 다정히 발맞추며 새로운 세계로 함께 나아가요.",
        groupLabel: "바다",
        groupColor: "#8EC5E8",
      }}
      locale="ko"
      trackView={false}
    />
  );
}
