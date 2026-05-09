"use client";

import { useState } from "react";
import Image from "next/image";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import type { TorisetsuType, TorisetsuTypeId } from "@/lib/types";
import { TypeIntroModal } from "./TypeIntroModal";

const TYPE_ORDER: TorisetsuTypeId[] = [
  "festival-sun",
  "everyones-home",
  "wild-charisma",
  "iron-mental",
  "delicate-creator",
  "healing-guardian",
  "deep-dive-explorer",
  "cool-maverick",
];

export function TypeCarousel() {
  const [selectedType, setSelectedType] = useState<TorisetsuType | null>(null);

  return (
    <>
      <div
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth gap-4 px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
      >
        {TYPE_ORDER.map((typeId) => {
          const type = torisetsuTypes[typeId];
          return (
            <button
              key={type.id}
              type="button"
              role="listitem"
              onClick={() => setSelectedType(type)}
              aria-label={`${type.name}の詳細を見る`}
              className="snap-center shrink-0 w-[75%] sm:w-[260px] rounded-2xl bg-white border border-card-border shadow-md p-5 text-center hover:shadow-lg active:scale-[0.98] transition-all"
            >
              {type.imageUrl && (
                <div className="relative mx-auto mb-3 w-32 h-32">
                  <Image
                    src={type.imageUrl}
                    alt=""
                    width={128}
                    height={128}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <h3
                className="mb-2 text-base font-extrabold"
                style={{ color: type.color }}
              >
                {type.name}
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                {type.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-muted mt-1">
        ← 横にスワイプ →
      </p>

      <TypeIntroModal
        type={selectedType}
        isOpen={selectedType !== null}
        onClose={() => setSelectedType(null)}
      />
    </>
  );
}
