// 友達診断 /tako 結果ページの「友達から見た恋愛傾向 / あなたのモテポイントは実はここ」。
// 友達平均スコアから決定的に選んだモテポイント (主 + 隠れ) を、他者視点のトーンで見せる。

import type { FriendLoveContent } from "@/lib/friend-love-content";

interface FriendLoveSectionProps {
  content: FriendLoveContent;
}

export function FriendLoveSection({ content }: FriendLoveSectionProps) {
  return (
    <div>
      {/* 主モテポイント (見せ場・淡ピンクカード) */}
      <div className="mb-8 rounded-3xl bg-[#FFF0F4] px-6 py-7">
        <p className="mb-2 text-[13px] font-black tracking-wide text-[#FF6B9D]">
          あなたのモテポイントは実はここ
        </p>
        <p className="text-[22px] font-black leading-[1.4] text-[#2E2E5C] md:text-[26px]">
          {content.main.headline}
        </p>
        <p className="body-gothic mt-4 text-[16px] font-normal leading-[1.75] text-[#1A1A1A]">
          {content.main.body}
        </p>
      </div>

      {/* 隠れモテポイント (2番目の軸・淡枠カード) */}
      <div className="rounded-3xl border-[1.5px] border-[#FFD9E4] px-6 py-6">
        <p className="mb-2 flex items-center gap-1.5 text-[14px] font-black text-[#FF6B9D]">
          <span aria-hidden="true">＋</span>
          もうひとつの隠れた魅力：{content.hidden.keyword}
        </p>
        <p className="body-gothic text-[15.5px] font-normal leading-[1.7] text-[#3A3A48]">
          {content.hidden.body}
        </p>
      </div>
    </div>
  );
}
