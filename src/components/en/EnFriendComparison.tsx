import {
  buildDimensionGaps,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import { EN_DIMENSIONS } from "@/i18n/en/friend";
import { ID_RESULT_AXES } from "@/i18n/id/result";

const ID_DIMENSIONS = Object.fromEntries(
  ID_RESULT_AXES.map((axis) => [axis.dim, axis]),
) as Record<
  (typeof ID_RESULT_AXES)[number]["dim"],
  (typeof ID_RESULT_AXES)[number]
>;

export default function EnFriendComparison({
  selfScores,
  friendScores,
  friendLabel = "Your friend",
  locale = "en",
}: {
  selfScores: BigFiveScores;
  friendScores: BigFiveScores;
  friendLabel?: string;
  locale?: "en" | "id";
}) {
  const gaps = buildDimensionGaps(selfScores, friendScores);
  const isIndonesian = locale === "id";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-5 text-xs font-bold text-[#5D5D78]">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#5B5BEF]" />
          {isIndonesian ? "Penilaian diri" : "Self-view"}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#E86AA6]" />
          {friendLabel}
        </span>
      </div>
      {gaps.map((gap) => {
        const enDimension = EN_DIMENSIONS[gap.key];
        const idDimension = ID_DIMENSIONS[gap.key];
        const label = isIndonesian ? idDimension.title : enDimension.label;
        const low = isIndonesian ? idDimension.left : enDimension.low;
        const high = isIndonesian ? idDimension.right : enDimension.high;
        return (
          <div key={gap.key}>
            <div className="mb-2 flex items-end justify-between gap-4">
              <div>
                <p className="font-extrabold text-[#2E2E5C]">
                  {label}
                </p>
                <p className="text-xs text-[#77778D]">
                  {low} ↔ {high}
                </p>
              </div>
              <p className="text-xs font-bold text-[#77778D]">
                {isIndonesian ? `Selisih ${gap.diffPoints} poin` : `${gap.diffPoints}-point gap`}
              </p>
            </div>
            <div
              className="space-y-2"
              aria-label={isIndonesian
                ? `${label}: penilaian diri ${gap.selfPercent} persen, ${friendLabel} ${gap.otherPercent} persen`
                : `${label}: self ${gap.selfPercent} percent, ${friendLabel} ${gap.otherPercent} percent`}
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
