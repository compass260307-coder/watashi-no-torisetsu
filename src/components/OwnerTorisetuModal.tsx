"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import type { TorisetsuTypeId } from "@/lib/types";
import { torisetsuTypes } from "@/lib/torisetsu-data";

interface OwnerTorisetuModalProps {
  isOpen: boolean;
  onClose: () => void;
  perceivedTypeId: TorisetsuTypeId;
  ownerName?: string | null;
  ctaHref?: string;
}

export function OwnerTorisetuModal({
  isOpen,
  onClose,
  perceivedTypeId,
  ownerName,
  ctaHref = "/diagnosis",
}: OwnerTorisetuModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const type = torisetsuTypes[perceivedTypeId];
  const subjectName = ownerName ?? "友達";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-modal-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`あなたから見た${subjectName}の印象`}
    >
      <div
        className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-modal-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky close header */}
        <div className="sticky top-0 z-10 bg-white px-5 py-3 border-b border-pink-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-foreground transition-colors"
            aria-label="閉じる"
          >
            ✕ 閉じる
          </button>
        </div>

        {/* ヘッダー */}
        <div className="px-5 py-6 text-center bg-gradient-to-b from-pink-50 to-white">
          <p className="text-sm text-muted mb-1">あなたから見た</p>
          <h2 className="text-xl font-extrabold text-foreground">
            {subjectName}さんは、こんな人かも
          </h2>
        </div>

        {/* タイプキャラ + タイプ名 */}
        <div className="px-5 pt-4 pb-2 text-center">
          {type.imageUrl && (
            <div className="relative mx-auto mb-4 w-44 h-44">
              <Image
                src={type.imageUrl}
                alt={`${type.name}のキャラクター`}
                width={176}
                height={176}
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <h3
            className="text-2xl font-extrabold mb-1"
            style={{ color: type.color }}
          >
            {type.name}
          </h3>
          <p className="text-xs text-muted">{type.subtitle}</p>
        </div>

        {/* 詳細説明 */}
        <div className="px-5 py-4">
          <h4 className="text-sm font-bold text-foreground mb-2">
            ▼ どんな人？
          </h4>
          <p className="text-sm text-foreground leading-relaxed">
            {type.detailDescription}
          </p>
        </div>

        {/* 特徴タグ */}
        <div className="px-5 py-4">
          <h4 className="text-sm font-bold text-foreground mb-3">
            ▼ こんな特徴
          </h4>
          <div className="flex flex-wrap gap-2">
            {type.traits.map((tag) => (
              <span
                key={tag}
                className="inline-block rounded-full bg-pink-50 border border-pink-100 px-3 py-1 text-xs font-bold text-pink-700"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* 注釈 */}
        <div className="mx-5 my-4 px-4 py-3 bg-pink-50/60 rounded-xl">
          <p className="text-xs text-muted leading-relaxed">
            💡 これは「あなたから見た」{subjectName}さんの印象です。
            他の友達からは違う見方がされているかもしれません。
          </p>
        </div>

        {/* CTA (sticky bottom) */}
        <div className="sticky bottom-0 bg-white border-t border-pink-100 px-5 py-5">
          <Link
            href={ctaHref}
            onClick={onClose}
            className="block w-full rounded-full bg-primary-gradient px-6 py-4 text-center text-base font-bold text-white shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            自分のトリセツも作ってみる →
          </Link>
          <p className="text-center text-[11px] text-muted mt-2">
            3分・無料・登録不要 🐧
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
