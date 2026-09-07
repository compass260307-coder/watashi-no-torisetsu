"use client";

// 自己診断前のナビ項目ロック中ポップオーバー。
//   自己診断が終わっていない (owner_token 無し) 状態でボトムナビの
//   「友達診断」「Alice」「運命」を押したときに、対象タブの少し上から
//   ぴょこっと出す小カード。
//   背景は暗くしない (モーダルではなく吹き出し)。外側タップ / Esc / ✕ で閉じ、
//   外側タップは下の要素の操作 (別タブへの遷移など) をブロックしない。
//   デザインは自己診断結果ページ (/me) に合わせる: 白カード + #2E2E5C 見出し +
//   丸数字ステップ + フェルトのマスコット (public/mascot)。

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

export type DiagnosisLockTarget = "friend" | "astrologer" | "unmei";

// ja/ko の文言セット。ko は既存の /ko/tako ガードページの言い回し
// (자기 진단 / 자기 진단 시작하기) に合わせる。
const COPY = {
  ja: {
    friend: {
      ariaLabel: "友達診断はロック中",
      heading: "友達診断はまだロック中",
      bodyLine1: "自己診断が完了すると、",
      bodyLine2: "友達に診断してもらえるよ",
    },
    astrologer: {
      ariaLabel: "Aliceはロック中",
      heading: "Aliceはまだロック中",
      bodyLine1: "自己診断が完了すると、",
      bodyLine2: "Aliceのコースを選べるよ",
    },
    unmei: {
      ariaLabel: "運命の設計図はロック中",
      heading: "運命の設計図はまだロック中",
      bodyLine1: "自己診断が完了すると、",
      bodyLine2: "設計図のコースを選べるよ",
    },
  },
  ko: {
    friend: {
      ariaLabel: "친구 진단 잠금 안내",
      heading: "친구 진단은 아직 잠겨 있어요",
      bodyLine1: "자기 진단을 완료하면",
      bodyLine2: "친구에게 진단을 받을 수 있어요",
    },
    astrologer: {
      ariaLabel: "상담사 잠금 안내",
      heading: "상담사는 아직 잠겨 있어요",
      bodyLine1: "자기 진단을 완료하면",
      bodyLine2: "상담 코스를 선택할 수 있어요",
    },
    unmei: {
      ariaLabel: "운명의 설계도 잠금 안내",
      heading: "운명의 설계도는 아직 잠겨 있어요",
      bodyLine1: "자기 진단을 완료하면",
      bodyLine2: "설계도 코스를 선택할 수 있어요",
    },
  },
} as const;

const LEFT_BY_TARGET: Record<DiagnosisLockTarget, string> = {
  friend: "30%",
  astrologer: "50%",
  unmei: "70%",
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  locale?: "ja" | "ko";
  target?: DiagnosisLockTarget;
}

export function TakoLockPopover({
  isOpen,
  onClose,
  locale = "ja",
  target = "friend",
}: Props) {
  const copy = COPY[locale][target];
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
    router.push(locale === "ko" ? "/ko/diagnosis" : "/diagnosis");
  };

  return createPortal(
    // ナビ (約58px) のすぐ上に固定し、対象タブへ下向きの三角で接続する。
    // タブ位置はナビと同じ「中央寄せ max-w-[480px] の5等分」を再現して合わせる:
    //   友達30% / Alice50% / 運命70% (ja / ko 共通)。
    <div
      className="fixed inset-x-0 z-50 animate-modal-slide-up"
      style={{ bottom: "calc(68px + env(safe-area-inset-bottom))" }}
      role="dialog"
      aria-label={copy.ariaLabel}
    >
      <div className="relative mx-auto w-full max-w-[480px]">
        <div
          ref={cardRef}
          className="absolute bottom-0 -translate-x-1/2 rounded-[20px] bg-white px-5 pb-[18px] pt-5 text-center"
          style={{
            // 320px幅でも左右のタブ上でカードが画面外へ出ない幅に縮める。
            width: "min(220px, 60vw)",
            left: LEFT_BY_TARGET[target],
            border: "1px solid rgba(46,46,92,0.10)",
            boxShadow: "0 12px 32px rgba(46,46,92,0.18)",
          }}
        >
          {/* 見出し (結果ページの font-black 見出しに合わせる) */}
          <h2 className="mb-1.5 break-keep text-[15px] font-black text-[#2E2E5C]">
            {copy.heading}
          </h2>
          <p className="mb-3.5 break-keep text-[12px] leading-[1.75] text-[#6B7280]">
            {copy.bodyLine1}
            <br />
            {copy.bodyLine2}
          </p>

          <button
            type="button"
            onClick={handleStart}
            className="block w-full rounded-full bg-[#2E2E5C] py-2.5 text-[13.5px] font-bold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {locale === "ko" ? "자기 진단 시작하기" : "テストを受ける"}
          </button>

          {/* 下向き三角: カード中心 (=対象タブの中心に位置合わせ済み) を指す */}
          <span
            aria-hidden="true"
            className="absolute -bottom-[7px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 bg-white"
            style={{
              borderRight: "1px solid rgba(46,46,92,0.10)",
              borderBottom: "1px solid rgba(46,46,92,0.10)",
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
