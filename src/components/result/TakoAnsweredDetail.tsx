"use client";

// 追加機能④ answered顔タップの詳細シート。相性ループの2分岐を出す。
//   まず「◯◯さんから見たあなた」を明示 (誰視点かの混乱防止・以前の合意)。そのうえで:
//   Path1 (友達が自己診断済み=friendOwnType32 あり): 「◯◯さんとの相性を見る」→ /aisho。
//   Path2 (未診断=本命): 相性は出せないので「◯◯さんを診断に誘う」。送信は③シートを再利用。
//
// 制約: 未診断の友達に「相性が出る」と誤認させない。無料バイパスを作らない。
//   新規カラー無し・既存フェルトトークン内・reduced-motion 尊重。

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  thirtyTwoName,
  thirtyTwoEssence,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";

const NAVY = "#2E2E5C";
const INACTIVE = "#9BA3B4";
const LAVENDER = "#5B5BEF";

export type AnsweredDetailFriend = {
  name: string;
  perceivedImageSrc: string | null;
  perceivedType32: ThirtyTwoTypeId | null;
  friendOwnType32: ThirtyTwoTypeId | null;
};

interface TakoAnsweredDetailProps {
  open: boolean;
  onClose: () => void;
  friend: AnsweredDetailFriend | null;
  /** 本人の32型 (/aisho?a=)。無いと Path1 は出せない。 */
  ownerType32: ThirtyTwoTypeId | null;
  /** Path2: 診断に誘う (③ TakoSendSheet を相性文脈で開く)。 */
  onInviteToDiagnose: () => void;
}

export function TakoAnsweredDetail({
  open,
  onClose,
  friend,
  ownerType32,
  onInviteToDiagnose,
}: TakoAnsweredDetailProps) {
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !friend) return null;

  // Path1 = 友達本人の型 と 本人の型 が両方あるときだけ (= 相性が実際に出せる)。
  const canCompat = Boolean(friend.friendOwnType32 && ownerType32);
  const aishoHref = canCompat
    ? `/aisho?a=${ownerType32}&b=${friend.friendOwnType32}`
    : "";

  const perceivedName = friend.perceivedType32
    ? thirtyTwoName(friend.perceivedType32)
    : null;
  const perceivedEssence = friend.perceivedType32
    ? thirtyTwoEssence(friend.perceivedType32)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${friend.name}から見たあなた`}
    >
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 ${reduced ? "" : "animate-modal-fade-in"}`}
      />

      <div
        className={`relative w-full max-w-[520px] rounded-t-[28px] bg-white px-5 pb-8 pt-3 shadow-[0_-12px_40px_rgba(46,46,92,0.18)] ${reduced ? "" : "animate-modal-slide-up"}`}
      >
        <div className="mb-3 flex items-center justify-center">
          <span className="h-1.5 w-10 rounded-full bg-[#E3E5EE]" />
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[#9BA3B4] transition-colors active:bg-[#F1F3FB]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {/* 誰視点かを明示 (混乱防止) */}
        <p className="text-center text-[13px] font-bold" style={{ color: INACTIVE }}>
          {friend.name}さんから見たあなた
        </p>

        {/* 「その友達から見たあなた」のキャラ */}
        <div className="mt-3 flex flex-col items-center">
          <div
            className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full"
            style={{ background: "#F4F4FE" }}
          >
            {friend.perceivedImageSrc ? (
              <Image
                src={friend.perceivedImageSrc}
                alt={`${friend.name}から見たあなた`}
                width={96}
                height={96}
                unoptimized
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-[34px] font-black" style={{ color: LAVENDER }}>
                {(friend.name || "と").charAt(0)}
              </span>
            )}
          </div>
          {perceivedName && (
            <p className="mt-2 text-[18px] font-black" style={{ color: NAVY }}>
              {perceivedName}
            </p>
          )}
          {perceivedEssence && (
            <p className="mt-0.5 text-center text-[13px] font-bold" style={{ color: INACTIVE }}>
              {perceivedEssence}
            </p>
          )}
        </div>

        {/* 分岐 CTA */}
        <div className="mt-6">
          {canCompat ? (
            /* Path1: 相性を見る (友達が自己診断済み) */
            <a
              href={aishoHref}
              data-no-drag
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[17px] font-black text-white shadow-[0_8px_24px_rgba(91,91,239,0.3)] transition-transform active:scale-[0.98]"
              style={{ background: LAVENDER }}
            >
              {friend.name}さんとの相性を見る
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          ) : (
            /* Path2 (本命): 未診断 → 診断に誘う。相性が出せるとは言わない。 */
            <>
              <div className="mb-4 rounded-2xl bg-[#F4F4FE] px-5 py-4">
                <p className="text-[15px] font-black leading-[1.5]" style={{ color: NAVY }}>
                  {friend.name}さんはあなたを見てくれた。
                  <br />
                  でもあなたはまだ{friend.name}さんを知らない。
                </p>
                <p className="mt-1.5 text-[12.5px] font-bold" style={{ color: INACTIVE }}>
                  {friend.name}さんが診断すると、2人の相性も見られるようになるよ
                </p>
              </div>
              <button
                type="button"
                onClick={onInviteToDiagnose}
                data-no-drag
                className="flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[17px] font-black text-white shadow-[0_8px_24px_rgba(91,91,239,0.3)] transition-transform active:scale-[0.98]"
                style={{ background: LAVENDER }}
              >
                {friend.name}さんを診断に誘う
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M8 7l4-4 4 4" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
