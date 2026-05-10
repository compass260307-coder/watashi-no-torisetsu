"use client";

import Image from "next/image";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import type { TorisetsuTypeId } from "@/lib/types";

interface Props {
  typeId: TorisetsuTypeId;
  answeredAt: string;
  onTap: () => void;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (date.getFullYear() === now.getFullYear()) {
    return `${month}/${day}`;
  }
  return `${date.getFullYear()}/${month}/${day}`;
}

export default function PerceptionCard({ typeId, answeredAt, onTap }: Props) {
  const type = torisetsuTypes[typeId];

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full bg-white rounded-2xl border border-pink-100 p-4 flex items-center gap-4 hover:border-pink-300 hover:shadow-sm transition-all text-left"
    >
      {type.imageUrl && (
        <div className="w-16 h-16 shrink-0">
          <Image
            src={type.imageUrl}
            alt=""
            width={64}
            height={64}
            className="w-full h-full object-contain"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3
          className="font-bold truncate"
          style={{ color: type.color }}
        >
          {type.name}
        </h3>
        <p className="text-xs text-muted mt-1">
          {formatDate(answeredAt)} の評価
        </p>
      </div>
      <span className="text-pink-400 text-xl leading-none">→</span>
    </button>
  );
}
