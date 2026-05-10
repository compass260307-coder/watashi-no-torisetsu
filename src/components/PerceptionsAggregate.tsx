import Image from "next/image";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import type { TorisetsuTypeId } from "@/lib/types";

interface Props {
  totalCount: number;
  mostCommonTypeId: TorisetsuTypeId | null;
  distribution: [TorisetsuTypeId, number][];
}

export default function PerceptionsAggregate({
  totalCount,
  mostCommonTypeId,
  distribution,
}: Props) {
  if (!mostCommonTypeId) return null;

  const mostCommonType = torisetsuTypes[mostCommonTypeId];
  const mostCommonCount = distribution[0]?.[1] ?? 0;
  const showDistributionChart = totalCount >= 2;

  return (
    <section className="px-5 py-4">
      <h2 className="text-lg font-bold text-foreground mb-4">📊 印象まとめ</h2>

      <div className="bg-white rounded-2xl border border-pink-100 p-6 mb-6 text-center shadow-sm">
        <p className="text-sm text-muted mb-3">
          {totalCount === 1 ? "あなたへの印象" : "もっとも多かった印象"}
        </p>
        {mostCommonType.imageUrl && (
          <div className="w-32 h-32 mx-auto mb-3">
            <Image
              src={mostCommonType.imageUrl}
              alt={mostCommonType.name}
              width={128}
              height={128}
              priority
              className="w-full h-full object-contain"
            />
          </div>
        )}
        <h3
          className="text-xl font-extrabold mb-1"
          style={{ color: mostCommonType.color }}
        >
          {mostCommonType.name}
        </h3>
        <p className="text-xs text-muted mt-2">
          {totalCount === 1
            ? "1 人の友達があなたをこう感じてくれました"
            : `${mostCommonCount} / ${totalCount} の友達がそう感じた`}
        </p>
      </div>

      {showDistributionChart && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-foreground mb-3">
            ▼ タイプ分布
          </h3>
          <div className="space-y-2">
            {distribution.map(([typeId, count]) => {
              const t = torisetsuTypes[typeId];
              const percentage = (count / totalCount) * 100;
              return (
                <div key={typeId} className="flex items-center gap-3">
                  <span
                    className="text-xs font-bold w-28 shrink-0 truncate"
                    style={{ color: t.color }}
                  >
                    {t.name}
                  </span>
                  <div className="flex-1 bg-pink-50 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: t.color,
                        opacity: 0.85,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted tabular-nums w-6 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalCount === 1 && (
        <p className="text-sm text-muted leading-relaxed bg-pink-50/50 p-4 rounded-xl">
          💡 もっと友達に聞いてみると、あなたへの印象が立体的に見えます。
        </p>
      )}
    </section>
  );
}
