// 「アナタと相性のいいタイプ」= 相性キャラ 2 体 (1位/2位) を横並び表示。
// 取説「相性の良いお相手」(文章) の置き換え。
//
// 設計方針:
//   - presentational な Server Component ("use client" 不要)。
//   - 相性は 8 タイプ粒度。1位 = report-data.ts の BEST_PARTNER_CONTENT、
//     2位 = compatibility.ts の SECOND_PARTNER (暫定)。
//   - 表示は 32 キャラ (v3)。8 タイプ → 代表 32 キャラは BASE_TYPE_TO_REP_32 (暫定)。

import Image from "next/image";
import type { TorisetsuTypeId } from "@/lib/types";
import { BEST_PARTNER_CONTENT } from "@/lib/report-data";
import {
  BASE_TYPE_TO_REP_32,
  SECOND_PARTNER,
  shortWhyCompatible,
} from "@/lib/compatibility";
import {
  thirtyTwoImagePath,
  thirtyTwoName,
  thirtyTwoEssence,
} from "@/lib/thirty-two-types";

interface CompatibleTypesProps {
  /** 本人の 8 タイプ ID (classifyType(scores) で導出済み)。 */
  typeId: TorisetsuTypeId;
  className?: string;
}

export function CompatibleTypes({
  typeId,
  className = "",
}: CompatibleTypesProps) {
  const first = BEST_PARTNER_CONTENT[typeId];
  const second = SECOND_PARTNER[typeId];

  const partners = [
    {
      rank: "相性 No.1",
      partnerType: first.partnerTypeId,
      reason: shortWhyCompatible(first.whyCompatible),
    },
    {
      rank: "相性 No.2",
      partnerType: second.partnerTypeId,
      reason: second.reason,
    },
  ];

  return (
    <section className={`mb-8 ${className}`.trim()}>
      <div className="flex items-center gap-3 mb-4">
        <span
          aria-hidden="true"
          className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3A2D6B] text-white text-lg flex items-center justify-center"
        >
          💞
        </span>
        <h2 className="text-[#3A2D6B] font-black text-xl leading-tight">
          アナタと相性のいいタイプ
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {partners.map((p) => {
          const rep = BASE_TYPE_TO_REP_32[p.partnerType];
          const img = thirtyTwoImagePath(rep);
          const name = thirtyTwoName(rep);
          const essence = thirtyTwoEssence(rep);
          return (
            <article
              key={p.rank}
              className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-4 flex flex-col items-center text-center"
            >
              <span className="text-[#FE3C72] font-black text-[10px] tracking-[0.2em] mb-2">
                {p.rank}
              </span>
              <div className="w-full aspect-square rounded-2xl bg-[#FFF0F3] flex items-center justify-center overflow-hidden mb-3">
                <Image
                  src={img}
                  alt={`${name}（${essence}）`}
                  width={200}
                  height={200}
                  className="w-[85%] h-[85%] object-contain"
                />
              </div>
              <p className="text-[#3A2D6B] font-black text-sm leading-tight">
                {name}
              </p>
              <p className="text-[#3A2D6B]/60 font-bold text-[11px] mb-2">
                {essence}
              </p>
              <p className="text-[#3A2D6B]/80 font-bold text-xs leading-relaxed">
                {p.reason}
              </p>
            </article>
          );
        })}
      </div>

      <p className="text-[#3A2D6B]/50 font-bold text-[10px] text-center mt-3">
        ※相性は性格の補い合いをもとにした目安です
      </p>
    </section>
  );
}
