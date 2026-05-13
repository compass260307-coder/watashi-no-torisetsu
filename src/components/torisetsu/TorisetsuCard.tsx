"use client";

import Image from "next/image";
import { useState } from "react";

export type TorisetsuCardSize = "sm" | "md" | "lg";

interface TorisetsuCardProps {
  fullCode: string;
  size?: TorisetsuCardSize;
  alt?: string;
  priority?: boolean;
  className?: string;
}

// カード画像は 1080×1350 (4:5)
const SIZE_PRESETS: Record<
  TorisetsuCardSize,
  { width: number; height: number }
> = {
  sm: { width: 240, height: 300 },
  md: { width: 400, height: 500 },
  lg: { width: 600, height: 750 },
};

export function TorisetsuCard({
  fullCode,
  size = "md",
  alt,
  priority = false,
  className = "",
}: TorisetsuCardProps) {
  const [hasError, setHasError] = useState(false);
  const { width, height } = SIZE_PRESETS[size];
  const src = `/cards/${fullCode}.png`;

  // フォールバック: 画像が見つからない / まだ生成中の場合
  if (hasError) {
    return (
      <div
        className={`relative rounded-2xl shadow-md flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 ${className}`.trim()}
        style={{ width, height, aspectRatio: "4 / 5" }}
        role="img"
        aria-label={alt ?? `${fullCode} カード (画像準備中)`}
      >
        <div className="text-2xl font-bold text-gray-400 tracking-wider">
          {fullCode}
        </div>
        <div className="text-xs text-gray-400 mt-2">画像準備中</div>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-2xl overflow-hidden shadow-lg bg-card-bg ${className}`.trim()}
      style={{ width, height, aspectRatio: "4 / 5" }}
    >
      <Image
        src={src}
        alt={alt ?? `${fullCode} カード`}
        width={width}
        height={height}
        priority={priority}
        onError={() => setHasError(true)}
        sizes={`(max-width: 640px) 100vw, ${width}px`}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
