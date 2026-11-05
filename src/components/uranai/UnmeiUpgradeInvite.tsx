import Image from "next/image";
import { ResultUpgradeChatLauncher } from "@/components/result-upgrade/ResultUpgradeChatLauncher";

export type UnmeiUpgradeOffer = {
  ownerToken: string;
  preview?: boolean;
  existingAnswers?: string[];
  initialState?: string | null;
};

export default function UnmeiUpgradeInvite({ offer }: { offer?: UnmeiUpgradeOffer }) {
  return (
    <section aria-label="Aliceからあなたへ" className="mx-auto mt-20 max-w-[820px] overflow-hidden rounded-3xl border border-[#EACC8D]/20 bg-[#10242D] text-[#FFF7E6] md:mt-28">
      <div className="grid items-center md:grid-cols-[1fr_1.1fr]">
        <div className="relative h-[300px] md:h-full md:min-h-[420px]">
          <Image src="/mascot/unmei-alice-complete-room-v1.webp" alt="星のノートを手に、あなたを迎えるAlice" fill sizes="(min-width: 768px) 390px, 100vw" className="object-cover object-[center_53%]" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#10242D] via-transparent to-transparent" />
        </div>
        <div className="px-6 pb-9 pt-2 text-center md:px-8 md:py-10 md:text-left">
          <p className="mb-3 text-xs font-bold tracking-widest text-[#EACC8D]">Alice</p>
          <h2 className="text-[22px] font-bold leading-relaxed">{offer ? <>今度は、あなたのことを<br />もう少し教えてね。</> : <>また話したくなったら、<br />いつでも会いに来てね。</>}</h2>
          {offer && <>
            <p className="mb-6 mt-4 text-sm leading-7 text-[#E1E5E3]">5つの質問に答えてくれたら、あなた専用のキャラクターとトリセツをつくるよ。好きなことや、大切にしていることを聞かせてね。</p>
            <ResultUpgradeChatLauncher ownerToken={offer.ownerToken} premiumPaid={false} preview={offer.preview} existingAnswers={offer.existingAnswers} initialState={offer.initialState} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#F1D18B] px-7 py-3 text-sm font-bold text-[#4C351D] shadow-[0_4px_0_#98703A] transition hover:bg-[#FFE3A6] active:translate-y-0.5">結果をアップグレード <span aria-hidden="true">→</span></ResultUpgradeChatLauncher>
          </>}
        </div>
      </div>
    </section>
  );
}
