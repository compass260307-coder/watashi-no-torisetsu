"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { TorisetsuType } from "@/lib/types";

interface Props {
  type: TorisetsuType | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TypeIntroModal({ type, isOpen, onClose }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // SSR 対応: クライアントマウント後のみ Portal 有効化
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

  if (!isOpen || !type || !mounted) return null;

  const handleStart = () => {
    onClose();
    router.push("/diagnosis");
  };

  // Portal で document.body 直下にレンダリング。
  // 親要素の transform / filter / contain が position:fixed を破壊する
  // gotcha を回避し、backdrop が viewport 全体を覆うようにする。
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-modal-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={type.name}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-y-auto animate-modal-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-100 transition-colors"
          aria-label="閉じる"
        >
          <span className="text-lg text-gray-700 font-bold leading-none">
            ✕
          </span>
        </button>

        <div className="p-6 text-center">
          {type.imageUrl && (
            <div className="relative mx-auto mb-4 w-48 h-48">
              <Image
                src={type.imageUrl}
                alt={type.name}
                width={192}
                height={192}
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <h2
            className="mb-2 text-2xl font-extrabold"
            style={{ color: type.color }}
          >
            {type.name}
          </h2>
          <p className="mb-4 text-xs text-muted">{type.subtitle}</p>

          <p className="mb-5 text-sm text-foreground leading-relaxed text-left">
            {type.detailDescription}
          </p>

          <div className="mb-6 flex flex-wrap justify-center gap-2">
            {type.traits.map((trait) => (
              <span
                key={trait}
                className="inline-block rounded-full bg-pink-50 border border-pink-100 px-3 py-1 text-xs font-bold text-pink-700"
              >
                {trait}
              </span>
            ))}
          </div>

          <div className="mb-5 border-t border-card-border" />

          <p className="mb-3 text-sm text-muted">あなたはこのタイプ？</p>
          <button
            type="button"
            onClick={handleStart}
            className="w-full rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            無料で診断する（3 分）
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
