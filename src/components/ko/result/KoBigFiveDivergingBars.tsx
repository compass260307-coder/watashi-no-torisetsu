import { KO_RESULT_AXES, KO_RESULT_COPY } from "@/i18n/ko/result";
import type { BigFiveDimension } from "@/lib/types";

interface KoBigFiveDivergingBarsProps {
  scores: Record<BigFiveDimension, number>;
}

function toPercent(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score * 10)));
}

function leanLabel(value: number, left: string, right: string): string {
  const distance = value - 50;
  const absoluteDistance = Math.abs(distance);

  if (absoluteDistance <= 7) return "가운데에 가까움";

  const pole = distance > 0 ? right : left;
  if (absoluteDistance <= 20) return `조금 ${pole}`;
  return `${pole} 성향`;
}

export function KoBigFiveDivergingBars({
  scores,
}: KoBigFiveDivergingBarsProps) {
  return (
    <section aria-labelledby="ko-result-axes-title">
      <div className="mb-5">
        <p className="text-[12px] font-extrabold tracking-[0.14em] text-[#5B5BEF]">
          BIG FIVE · OCEAN
        </p>
        <h2
          id="ko-result-axes-title"
          className="mt-2 break-keep text-[27px] font-extrabold leading-tight tracking-[-0.03em] text-[#2E2E5C] sm:text-[34px]"
        >
          {KO_RESULT_COPY.axesTitle}
        </h2>
        <p className="mt-3 break-keep text-[15px] leading-relaxed text-[#727287] sm:text-[16px]">
          {KO_RESULT_COPY.axesDescription}
        </p>
      </div>

      <div className="space-y-6 rounded-[24px] border border-[#E3E6F5] bg-white p-5 shadow-[0_14px_44px_rgba(46,46,92,0.06)] sm:p-7">
        {KO_RESULT_AXES.map((axis) => {
          const value = toPercent(scores[axis.dim]);
          const lean = leanLabel(value, axis.left, axis.right);
          const fillLeft = value >= 50 ? 50 : value;
          const fillWidth = Math.abs(value - 50);

          return (
            <div key={axis.dim}>
              <span className="sr-only">
                {axis.title}: {lean}, {value}%
              </span>

              <div
                aria-hidden="true"
                className="mb-2 flex items-baseline gap-1.5"
              >
                <span className="text-[15px] font-bold text-[#2E2E5C]">
                  {axis.title}:
                </span>
                <span
                  className="text-[15px] font-black tabular-nums"
                  style={{ color: axis.color }}
                >
                  {value}%
                </span>
                <span className="text-[15px] font-bold text-[#2E2E5C]">
                  {lean}
                </span>
              </div>

              <div aria-hidden="true" className="relative h-4 w-full">
                <div
                  className="absolute inset-0 overflow-hidden rounded-full"
                  style={{ background: `${axis.color}2E` }}
                >
                  <div
                    className="absolute top-0 h-full transition-all duration-500"
                    style={{
                      left: `${fillLeft}%`,
                      width: `${fillWidth}%`,
                      minWidth: value === 50 ? "2px" : undefined,
                      background: axis.color,
                    }}
                  />
                </div>

                <div className="absolute left-1/2 top-1/2 h-5 w-px -translate-x-1/2 -translate-y-1/2 bg-[#2E2E5C]/30" />
                <div
                  className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md transition-all duration-500"
                  style={{
                    left: `${value}%`,
                    border: `4px solid ${axis.color}`,
                  }}
                />
              </div>

              <div
                aria-hidden="true"
                className="mt-1.5 flex items-center justify-between text-[12px] font-bold leading-tight text-[#2E2E5C]/55"
              >
                <span>{axis.left}</span>
                <span>{axis.right}</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 break-keep text-[12px] leading-relaxed text-[#8A8AA3]">
        {KO_RESULT_COPY.axesNote}
      </p>
    </section>
  );
}
