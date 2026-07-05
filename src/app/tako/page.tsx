// 他己診断 (タコ診断) の入口・未診断ガード /tako (token 無し)。
//   ボトムナビ「他己診断」を押したが、まだ自己診断していない (owner_token 無し)
//   ユーザーに出す誘導画面。「まず自己診断から」+ 3ステップ + 自己診断CTA。
//   token 有りは BottomNav が /tako/[token] へ送る (解除/ロックは [token] 側)。

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "他己診断",
  robots: { index: false, follow: false },
};

// 人物＋虫めがね (自己診断=自分を探す)。currentColor 追従。
function UserSearchIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10" cy="8" r="3.4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20c0-3.3 2.7-5.5 6-5.5 1 0 1.9.2 2.7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="16" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="m21 20-1.8-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// キラッ (4点星)。ボタン内アクセント。
function SparklesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2c.5 4.5 3 7 7.5 7.5C15 10 12.5 12.5 12 17c-.5-4.5-3-7-7.5-7.5C9 9 11.5 6.5 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

// 3ステップ (現在地=自己診断)。
function StepDots() {
  const steps = [
    { n: 1, label: "自己診断", active: true },
    { n: 2, label: "友達に依頼", active: false },
    { n: 3, label: "他己が解禁", active: false },
  ];
  return (
    <div className="mb-7 flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-1.5">
          <div className="flex flex-col items-center gap-1">
            <div
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-sm font-bold"
              style={
                s.active
                  ? { background: "#2A3A5C", color: "#fff" }
                  : { background: "#E0DAC9", color: "#9A9585" }
              }
            >
              {s.n}
            </div>
            <span
              className="text-[9px] font-bold"
              style={{ color: s.active ? "#2A3A5C" : "#9A9585" }}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="h-0.5 w-6" style={{ background: "#C3BCA6" }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function TakoIntroPage() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center px-7 text-center"
      style={{ background: "#FBF8F0" }}
    >
      {/* アイコン (ネイビー丸) */}
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: "#2A3A5C",
          color: "#F3EFE0",
          boxShadow: "0 6px 18px rgba(42,58,92,0.28)",
        }}
      >
        <UserSearchIcon />
      </div>

      <h1 className="mt-[18px] mb-1.5 text-lg font-bold leading-relaxed text-[#2A3A5C]">
        まず、自分を知ることから
      </h1>
      <p className="mb-1 text-[12.5px] leading-[1.9] text-[#6B6858]">
        「みんなから見たあなた」を知るには、
        <br />
        先に自分の診断が必要です。
      </p>
      <p className="mb-6 text-[12.5px] leading-[1.9] text-[#6B6858]">
        自分のトリセツができたら、
        <br />
        友達に診断してもらえるようになります。
      </p>

      <StepDots />

      {/* 主ボタン → 自己診断 */}
      <Link
        href="/diagnosis"
        className="flex w-full max-w-[360px] items-center justify-center gap-2 rounded-3xl py-3.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: "#2A3A5C" }}
      >
        <SparklesIcon />
        自己診断をはじめる
      </Link>
      <p className="mt-3 text-[10.5px] text-[#9A9585]">3分・50問でわかります</p>
    </main>
  );
}
