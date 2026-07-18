"use client";

// 友達診断ロック中ポップオーバー。
//   自己診断が終わっていない (owner_token 無し) 状態でボトムナビの
//   「友達診断」を押したときに、ナビの少し上からぴょこっと出す小カード。
//   背景は暗くしない (モーダルではなく吹き出し)。外側タップ / Esc / ✕ で閉じ、
//   外側タップは下の要素の操作 (別タブへの遷移など) をブロックしない。
//   デザインは自己診断結果ページ (/me) に合わせる: 白カード + #2E2E5C 見出し +
//   丸数字ステップ + フェルトのマスコット (public/mascot)。

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function TakoLockPopover({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // SSR 対応: クライアントマウント後のみ Portal 有効化
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // 外側タップで閉じる (透明オーバーレイは使わない: 下の要素の操作を殺さないため
  // document の pointerdown を監視し、カード外なら閉じるだけにする)。
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleOutside = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    document.addEventListener("pointerdown", handleOutside);
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.removeEventListener("pointerdown", handleOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleStart = () => {
    onClose();
    router.push("/diagnosis");
  };

  return createPortal(
    // ナビ (約58px) のすぐ上に固定。ナビ中央=友達診断タブへ下向きの三角で接続する。
    <div
      className="fixed inset-x-0 z-50 flex justify-center px-5 animate-modal-slide-up"
      style={{ bottom: "calc(68px + env(safe-area-inset-bottom))" }}
      role="dialog"
      aria-label="友達診断はロック中"
    >
      <div
        ref={cardRef}
        className="relative w-full max-w-[220px] rounded-[20px] bg-white px-5 pb-[18px] pt-5 text-center"
        style={{
          border: "1px solid rgba(46,46,92,0.10)",
          boxShadow: "0 12px 32px rgba(46,46,92,0.18)",
        }}
      >
        {/* 見出し (結果ページの font-black 見出しに合わせる) */}
        <h2 className="mb-1.5 text-[15px] font-black text-[#2E2E5C]">
          友達診断はまだロック中
        </h2>
        <p className="mb-3.5 text-[12px] leading-[1.75] text-[#6B7280]">
          自己診断が完了すると、
          <br />
          友達に診断してもらえるよ
        </p>

        <button
          type="button"
          onClick={handleStart}
          className="block w-full rounded-full bg-[#2E2E5C] py-2.5 text-[13.5px] font-bold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          テストを受ける
        </button>

        {/* 下向き三角: 友達診断タブ (5列の中央) を指す */}
        <span
          aria-hidden="true"
          className="absolute -bottom-[7px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 bg-white"
          style={{
            borderRight: "1px solid rgba(46,46,92,0.10)",
            borderBottom: "1px solid rgba(46,46,92,0.10)",
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
