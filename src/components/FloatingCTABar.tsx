// Phase 1.5-α Day 12-Polish-D-B: LP フローティング CTA を 1 ボタン化 + 白背景撤去
//
// 旧 (Day 1): 4 状態 (guest/diagnosed/perceived/paid) × 主 / 副 2 ボタン構成、
//             白カプセル背景バー (rgba(255,249,240,0.95) + lavender border + boxShadow)
//
// 新 (Polish-D-B):
//   - 状態を 2 つに統合: guest / diagnosed (diagnosed には perceived / paid を含む)
//   - 状態別 1 ボタンのみ表示、サービスのコア体験 (相互理解度) への自然な誘導に統一
//     - guest:     「無料で診断する」     → /diagnosis
//     - diagnosed: 「相互理解度を測る」  → /friend-evaluation
//   - 白背景バーを撤去、ボタン単体を grid-bg の上にふわっと浮かせる
//     (FriendFlowFloatingCta = Day 12-C3-fix と同じ方針)
//   - Brand v2 標準 CTA スタイル (sunYellow + deepPurple border + shadow-[0_4px_0])
//   - iOS safe-area 対応 (padding-bottom: env(safe-area-inset-bottom))
//
// 古い言語「真のトリセツ ¥500」が LP から消え、「相互理解度」というサービスの
// 新しい核に言語統一される。
//
// セッション判定は getSession() のみ。owner_token があれば diagnosed 扱い
// (createSession は type_id 必須のため、有効 session ≒ 診断済)。

import Link from "next/link";
import { getSession } from "@/lib/session";

type CTAState = { type: "guest" } | { type: "diagnosed" };

async function detectState(): Promise<CTAState> {
  const session = await getSession();
  if (!session?.owner_token) return { type: "guest" };
  return { type: "diagnosed" };
}

interface CtaButton {
  label: string;
  href: string;
}

function buttonFor(state: CTAState): CtaButton {
  switch (state.type) {
    case "guest":
      return { label: "無料で診断する", href: "/diagnosis" };
    case "diagnosed":
      return { label: "相互理解度を測る", href: "/friend-evaluation" };
  }
}

export default async function FloatingCTABar() {
  const state = await detectState();
  const button = buttonFor(state);

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[480px] z-50 flex justify-center"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Polish-D-B revised: Polish-D-A 統一基準 (px-10 → px-8) に揃える */}
      <Link
        href={button.href}
        className="rounded-full px-8 py-4 text-base font-black bg-[#FFE993] text-[#3A2D6B] border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all duration-150 min-w-[220px] text-center"
      >
        {button.label}
      </Link>
    </div>
  );
}
