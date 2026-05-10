"use client";

import { useState } from "react";
import Link from "next/link";
import { OwnerTorisetuModal } from "./OwnerTorisetuModal";
import PerceptionsAggregate from "./PerceptionsAggregate";
import PerceptionCard from "./PerceptionCard";
import EmptyPerceptions from "./EmptyPerceptions";
import type { TorisetsuTypeId } from "@/lib/types";

type Perception = {
  id: string;
  typeId: TorisetsuTypeId;
  answeredAt: string;
};

interface Props {
  ownerName: string | null;
  totalCount: number;
  mostCommonTypeId: TorisetsuTypeId | null;
  distribution: [TorisetsuTypeId, number][];
  perceptions: Perception[];
  inviteHref: string;
}

export default function PerceptionsView({
  ownerName,
  totalCount,
  mostCommonTypeId,
  distribution,
  perceptions,
  inviteHref,
}: Props) {
  const [selectedTypeId, setSelectedTypeId] = useState<TorisetsuTypeId | null>(
    null,
  );

  if (totalCount === 0) {
    return <EmptyPerceptions inviteHref={inviteHref} />;
  }

  const subjectLabel = ownerName ?? "あなた";

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <header className="px-5 py-6 text-center">
        <h1 className="text-2xl font-extrabold text-foreground">
          🐧 友達からの印象
        </h1>
        <p className="text-sm text-muted mt-1">
          {subjectLabel}
          {ownerName ? "さん" : ""}への {totalCount} 人の声
        </p>
      </header>

      <PerceptionsAggregate
        totalCount={totalCount}
        mostCommonTypeId={mostCommonTypeId}
        distribution={distribution}
      />

      <section className="px-5 py-6">
        <h2 className="text-lg font-bold text-foreground mb-4">
          💭 個別の印象（{totalCount} 件）
        </h2>
        <div className="space-y-3">
          {perceptions.map((p) => (
            <PerceptionCard
              key={p.id}
              typeId={p.typeId}
              answeredAt={p.answeredAt}
              onTap={() => setSelectedTypeId(p.typeId)}
            />
          ))}
        </div>
      </section>

      <section className="px-5 pb-10">
        <Link
          href={inviteHref}
          className="block w-full rounded-full bg-primary-gradient px-6 py-4 text-center text-base font-bold text-white shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          もっと友達に聞いてみる →
        </Link>
      </section>

      {selectedTypeId && (
        <OwnerTorisetuModal
          isOpen
          onClose={() => setSelectedTypeId(null)}
          perceivedTypeId={selectedTypeId}
          ownerName={subjectLabel}
          ctaHref="/diagnosis"
        />
      )}
    </main>
  );
}
