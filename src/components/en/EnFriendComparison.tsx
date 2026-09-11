import {
  buildDimensionGaps,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import { EN_DIMENSIONS } from "@/i18n/en/friend";

export default function EnFriendComparison({
  selfScores,
  friendScores,
  friendLabel = "Your friend",
}: {
  selfScores: BigFiveScores;
  friendScores: BigFiveScores;
  friendLabel?: string;
}) {
  const gaps = buildDimensionGaps(selfScores, friendScores);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-5 text-xs font-bold text-[#5D5D78]">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#5B5BEF]" />
          Self-view
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#E86AA6]" />
          {friendLabel}
        </span>
      </div>
      {gaps.map((gap) => {
        const dimension = EN_DIMENSIONS[gap.key];
        return (
          <div key={gap.key}>
            <div className="mb-2 flex items-end justify-between gap-4">
              <div>
                <p className="font-extrabold text-[#2E2E5C]">
                  {dimension.label}
                </p>
                <p className="text-xs text-[#77778D]">
                  {dimension.low} ↔ {dimension.high}
                </p>
              </div>
              <p className="text-xs font-bold text-[#77778D]">
                {gap.diffPoints}-point gap
              </p>
            </div>
            <div
              className="space-y-2"
              aria-label={`${dimension.label}: self ${gap.selfPercent} percent, ${friendLabel} ${gap.otherPercent} percent`}
            >
              <div className="h-2.5 overflow-hidden rounded-full bg-[#EEEEF7]">
                <div
                  className="h-full rounded-full bg-[#5B5BEF]"
                  style={{ width: `${gap.selfPercent}%` }}
                />
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#F8EAF1]">
                <div
                  className="h-full rounded-full bg-[#E86AA6]"
                  style={{ width: `${gap.otherPercent}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
