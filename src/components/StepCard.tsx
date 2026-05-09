import Image from "next/image";
import type { ReactNode } from "react";

export type StepCardVariant = "completed" | "current" | "future";

export interface StepCardProps {
  stepNumber: 1 | 2 | 3;
  imageSrc: string;
  title: ReactNode;
  subtitle?: string;
  variant?: StepCardVariant;
}

const variantContainerClass: Record<StepCardVariant, string> = {
  completed: "border border-card-border shadow-sm opacity-60",
  current: "border-2 border-primary shadow-md ring-2 ring-primary/15",
  future: "border border-card-border shadow-sm",
};

function variantBadge(variant: StepCardVariant): ReactNode {
  if (variant === "completed") {
    return (
      <span className="text-[11px] font-bold text-emerald-600">✓ 完了</span>
    );
  }
  if (variant === "current") {
    return (
      <span className="text-[11px] font-bold text-primary">← いまここ</span>
    );
  }
  return null;
}

export function StepCard({
  stepNumber,
  imageSrc,
  title,
  subtitle,
  variant = "future",
}: StepCardProps) {
  return (
    <div
      className={`flex flex-col items-center rounded-2xl bg-card-bg p-6 ${variantContainerClass[variant]}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-block rounded-full bg-primary-gradient px-3 py-1 text-[11px] font-bold text-white tracking-wider">
          STEP {stepNumber}
        </span>
        {variantBadge(variant)}
      </div>
      <div className="w-48 h-48 mb-4">
        <Image
          src={imageSrc}
          alt=""
          width={192}
          height={192}
          className="w-full h-full object-contain"
        />
      </div>
      <h3 className="text-base font-bold text-center leading-snug mb-2">
        {title}
      </h3>
      {subtitle && (
        <p className="text-xs text-muted text-center">{subtitle}</p>
      )}
    </div>
  );
}
