import type { ResultItem } from "@/lib/result-items";

// 「共通の見出し + タイプ別の結論の一行 + 本文」の項目を並べる (スマホ1列 / PC2列)。
// ロック中の見本 (ぼかしたデコイ) と同じ並びで出し、見出しは小さく、タイプ別の lead を大きく見せる。
export function ResultItemGrid({
  items,
  className = "",
}: {
  items: ResultItem[];
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2 ${className}`.trim()}
    >
      {items.map((it) => (
        <div key={it.heading}>
          <p className="mb-0.5 text-[13px] font-bold text-[#2E2E5C]/60">
            {it.heading}
          </p>
          <p className="mb-1.5 text-[17px] font-black leading-[1.4] text-[#2E2E5C]">
            {it.lead}
          </p>
          <p className="body-gothic text-[15px] leading-[1.6] text-[#1A1A1A]">
            {it.body}
          </p>
        </div>
      ))}
    </div>
  );
}
