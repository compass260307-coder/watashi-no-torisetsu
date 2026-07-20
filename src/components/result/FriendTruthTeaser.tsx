import Link from "next/link";
import type { ResultLocale } from "@/i18n/result";

interface FriendTruthTeaserProps {
  href: string;
  friendCount: number;
  threshold: number;
  variant?: "truth" | "caution";
  locale?: ResultLocale;
}

const TEASER_CONTENT = {
  truth: {
    title: "本物の友達が思っていること",
    description:
      "友達に診断してもらって、周りから見たあなたの魅力や意外な一面を見てみましょう。",
    results: [
      { label: "みんなから見たタイプ", color: "#56BFE8" },
      { label: "好きなところ", color: "#F48BAE" },
      { label: "友達だけが知る一面", color: "#4CAF7D" },
      { label: "友達の中での役割", color: "#F2B83F" },
    ],
  },
  caution: {
    title: "友達だけが知る注意点",
    description:
      "友達に診断してもらって、自分では気づきにくい本当の注意点を知りましょう。",
    results: [
      { label: "気にしすぎな短所", color: "#56BFE8" },
      { label: "本当の注意点", color: "#F48BAE" },
      { label: "言いにくい本音", color: "#4CAF7D" },
      { label: "一緒にいる理由", color: "#F2B83F" },
    ],
  },
} as const;

const KO_TEASER_CONTENT = {
  truth: {
    title: "실제 친구들이 생각하는 나",
    description:
      "친구에게 진단을 부탁하고, 주변에서 보는 나의 매력과 뜻밖의 모습을 확인해 보세요.",
    results: [
      { label: "친구들이 보는 유형", color: "#56BFE8" },
      { label: "좋아하는 점", color: "#F48BAE" },
      { label: "친구만 아는 모습", color: "#4CAF7D" },
      { label: "친구 사이에서의 역할", color: "#F2B83F" },
    ],
  },
  caution: {
    title: "친구만 아는 주의점",
    description:
      "친구에게 진단을 부탁하고, 스스로 알아차리기 어려운 진짜 주의점을 확인해 보세요.",
    results: [
      { label: "너무 신경 쓰는 단점", color: "#56BFE8" },
      { label: "진짜 주의점", color: "#F48BAE" },
      { label: "말하기 어려운 속마음", color: "#4CAF7D" },
      { label: "함께 있는 이유", color: "#F2B83F" },
    ],
  },
} as const;

function LockGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function FriendTruthTeaser({
  href,
  friendCount,
  threshold,
  variant = "truth",
  locale = "ja",
}: FriendTruthTeaserProps) {
  const answered = Math.min(Math.max(friendCount, 0), threshold);
  const completed = answered >= threshold;
  const isKorean = locale === "ko";
  const content = (isKorean ? KO_TEASER_CONTENT : TEASER_CONTENT)[variant];
  const ctaText = completed
    ? isKorean ? "친구가 본 결과 보기" : "友達からの結果を見る"
    : isKorean ? "실제 친구의 답변 보기" : "本物の友達の答えを見る";

  return (
    <div className="mb-10">
      <h3 className="mb-3 text-[20px] font-black text-[#2E2E5C]">
        {content.title}
      </h3>

      <Link
        href={href}
        aria-label={
          completed
            ? isKorean ? `${content.title} 보기` : `${content.title}を見る`
            : isKorean ? "실제 친구의 답변 보기" : "本物の友達の答えを見る"
        }
        className="group block overflow-hidden rounded-lg border border-[#E3E6F5] bg-white shadow-[0_6px_22px_rgba(46,46,92,0.08)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5B5BEF]/25"
      >
        <div className="px-5 py-7 md:px-8 md:py-9">
          <div className="mx-auto grid max-w-[620px] grid-cols-2 gap-x-4 gap-y-7 md:gap-x-12 md:gap-y-8">
            {content.results.map((item) => (
              <div key={item.label} className="flex min-w-0 flex-col items-center">
                <span
                  aria-hidden="true"
                  className="flex h-24 w-24 items-center justify-center rounded-full border-4 bg-white text-[#B9BCCF] transition-transform duration-200 group-hover:scale-105 md:h-28 md:w-28"
                  style={{ borderColor: item.color }}
                >
                  <LockGlyph size={30} />
                </span>
                <span className="mt-2.5 max-w-full text-center text-[12px] font-black leading-[1.45] text-[#2E2E5C] md:text-[13px]">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 pb-7 pt-1 md:px-8 md:pb-9">
          <div className="relative mx-auto w-[88%] max-w-[480px] rounded-lg border border-[#E3E6F5] border-t-[3px] border-t-[#5B5BEF] px-5 pb-6 pt-7 text-center">
            <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white">
              <LockGlyph size={14} />
            </span>
            <p className="mb-1.5 text-[18px] font-black text-[#2E2E5C] md:text-[19px]">
              {completed
                ? isKorean ? "친구의 답변 확인" : "友達からの答えを確認"
                : isKorean ? "친구만 아는 답변 열기" : "友達だけが知る答えを解放"}
            </p>
            <p className="mb-4 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/65">
              {completed
                ? isKorean ? "모인 친구 답변의 결과를 확인해 보세요." : "集まった友達からの結果を見てみましょう。"
                : content.description}
            </p>
            <span className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#5B5BEF] px-5 py-3 text-[13px] font-black text-white shadow-[0_3px_0_#3D3DC4] transition-transform duration-200 group-hover:translate-y-0.5">
              {ctaText}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
