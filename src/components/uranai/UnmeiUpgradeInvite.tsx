import Image from "next/image";
import { ResultUpgradeChatLauncher } from "@/components/result-upgrade/ResultUpgradeChatLauncher";

export type UnmeiUpgradeOffer = {
  ownerToken: string;
  preview?: boolean;
  existingAnswers?: string[];
  initialState?: string | null;
};

const COPY = {
  ja: {
    aria: "Aliceからあなたへ",
    imageAlt: "星のノートを手に、あなたを迎えるAlice",
    offerTitle: ["今度は、あなたのことを", "もう少し教えてね。"],
    closingTitle: ["また話したくなったら、", "いつでも会いに来てね。"],
    body: "7つの質問に答えてくれたら、あなた専用のキャラクターとトリセツをつくるよ。好きなことや、大切にしていることを聞かせてね。",
    cta: "結果をアップグレード",
  },
  ko: {
    aria: "Alice가 전하는 말",
    imageAlt: "별의 노트를 들고 당신을 맞이하는 Alice",
    offerTitle: ["이번에는 당신에 대해", "조금 더 들려주세요."],
    closingTitle: ["또 이야기하고 싶어지면", "언제든 만나러 와 주세요."],
    body: "다섯 가지 질문에 답해 주면, 당신만을 위한 캐릭터와 사용설명서를 만들어 드릴게요. 좋아하는 것과 소중하게 여기는 것을 들려주세요.",
    cta: "결과 업그레이드",
  },
} as const;

export default function UnmeiUpgradeInvite({ offer, locale = "ja" }: { offer?: UnmeiUpgradeOffer; locale?: "ja" | "ko" }) {
  const copy = COPY[locale];
  return (
    <section aria-label={copy.aria} className="mx-auto mt-20 max-w-[820px] overflow-hidden rounded-3xl border border-[#EACC8D]/20 bg-[#10242D] text-[#FFF7E6] md:mt-28">
      <div className="grid items-center md:grid-cols-[1fr_1.1fr]">
        <div className="relative h-[300px] md:h-full md:min-h-[420px]">
          <Image src="/mascot/unmei-alice-complete-room-v1.webp" alt={copy.imageAlt} fill sizes="(min-width: 768px) 390px, 100vw" className="object-cover object-[center_53%]" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#10242D] via-transparent to-transparent" />
        </div>
        <div className="px-6 pb-9 pt-2 text-center md:px-8 md:py-10 md:text-left">
          <p className="mb-3 text-xs font-bold tracking-widest text-[#EACC8D]">Alice</p>
          <h2 className="text-[22px] font-bold leading-relaxed">{offer ? <>{copy.offerTitle[0]}<br />{copy.offerTitle[1]}</> : <>{copy.closingTitle[0]}<br />{copy.closingTitle[1]}</>}</h2>
          {offer && <>
            <p className="mb-6 mt-4 text-sm leading-7 text-[#E1E5E3]">{copy.body}</p>
            <ResultUpgradeChatLauncher locale={locale} ownerToken={offer.ownerToken} premiumPaid={false} preview={offer.preview} existingAnswers={offer.existingAnswers} initialState={offer.initialState} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#F1D18B] px-7 py-3 text-sm font-bold text-[#4C351D] shadow-[0_4px_0_#98703A] transition hover:bg-[#FFE3A6] active:translate-y-0.5">{copy.cta} <span aria-hidden="true">→</span></ResultUpgradeChatLauncher>
          </>}
        </div>
      </div>
    </section>
  );
}
