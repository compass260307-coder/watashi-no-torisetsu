"use client";

import { useEffect } from "react";
import Image from "next/image";
import type { TorisetsuTypeId } from "@/lib/types";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import { TYPE_DEEP_DIVE, DEEP_DIVE_SECTION_ORDER } from "@/lib/report-data";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  typeId: TorisetsuTypeId | null;
  unlocked: boolean;
  inviteHref: string;
  isSelf?: boolean;
  count?: number;
}

export function TypeDetailModal({
  isOpen,
  onClose,
  typeId,
  unlocked,
  inviteHref,
  isSelf,
  count,
}: Props) {
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

  if (!isOpen || !typeId) return null;

  const meta = torisetsuTypes[typeId];
  const dive = TYPE_DEEP_DIVE[typeId];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-modal-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={unlocked ? meta.name : "未開放のタイプ"}
    >
      <div
        className="relative w-full h-[100dvh] sm:h-[85vh] sm:max-w-md bg-white sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-modal-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
          aria-label="閉じる"
        >
          <span className="text-xl text-gray-700 font-bold leading-none">
            ✕
          </span>
        </button>

        <div className="overflow-y-auto flex-1 p-6">
          {/* 画像 */}
          {meta.imageUrl && (
            <div className="relative mx-auto mb-4 w-full max-w-[240px] aspect-square">
              <Image
                src={meta.imageUrl}
                alt={unlocked ? meta.name : "未開放"}
                width={240}
                height={240}
                className={`w-full h-full object-contain ${
                  unlocked ? "" : "grayscale opacity-30 blur-[1.5px]"
                }`}
              />
              {!unlocked && (
                <div className="absolute inset-0 flex items-center justify-center text-7xl text-gray-400 font-bold">
                  ？
                </div>
              )}
            </div>
          )}

          {/* タイプ名 + バッジ */}
          <div className="text-center mb-5">
            {!unlocked ? (
              <p className="text-xl font-extrabold text-gray-400">？？？</p>
            ) : (
              <>
                <p
                  className="text-xl font-extrabold mb-1"
                  style={{ color: meta.color }}
                >
                  {meta.name}
                </p>
                <p className="text-xs text-muted">{meta.subtitle}</p>
                {(isSelf || (count !== undefined && count > 0)) && (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    {isSelf && (
                      <span className="inline-block rounded-full bg-pink-500 text-white text-[10px] font-bold px-2.5 py-0.5">
                        YOU
                      </span>
                    )}
                    {!isSelf && count !== undefined && count > 0 && (
                      <span className="inline-block rounded-full bg-pink-50 border border-pink-200 text-pink-700 text-[10px] font-bold px-2.5 py-0.5">
                        {count}人
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Body */}
          {unlocked ? (
            dive ? (
              <div className="flex flex-col gap-4">
                {DEEP_DIVE_SECTION_ORDER.map((key) => {
                  const sec = dive[key];
                  return (
                    <div
                      key={key}
                      className="border-t border-card-border pt-3 first:border-t-0 first:pt-0"
                    >
                      <p
                        className="text-sm font-bold mb-2"
                        style={{ color: meta.color }}
                      >
                        {sec.title}
                      </p>
                      <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-line">
                        {sec.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted text-center">
                詳細解説は準備中です🐧
              </p>
            )
          ) : (
            <div className="flex flex-col items-center text-center gap-3 mt-4">
              <p className="text-base font-bold leading-relaxed">
                まだ出会ってないよ🐧
              </p>
              <p className="text-sm text-muted leading-relaxed">
                あなたの招待で診断した友達が
                <br />
                このタイプ だったら 図鑑 に追加されるよ。
              </p>
              <a
                href={inviteHref}
                className="inline-block rounded-full bg-primary-gradient px-6 py-3 text-sm font-bold text-white shadow-md mt-3"
              >
                他己評価を依頼する
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
