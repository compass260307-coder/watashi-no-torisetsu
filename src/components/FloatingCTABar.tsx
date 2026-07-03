// Phase 1.5-α Day 12-Polish-D-B FINAL: LP フローティングを StickyCtaFooter (scrim) に載せ替え
//
// 旧 (Day 1):     4 状態 (guest / diagnosed / perceived / paid) × 主 / 副 2 ボタン構成、
//                 白カプセル背景バー (rgba(255,249,240,0.95) + lavender border + boxShadow)
// 旧 (Polish-D-B): 2 状態に統合、白背景撤去 (Link を fixed bottom-4 で浮かせる)
//                  → 独自 fixed レイアウト + 立体シャドウだけ持つ、他画面と微妙にズレ
//
// 新 (D-B FINAL): 全画面共通の StickyCtaFooter (scrim 既定) に載せ替え。
//                 LP は背景が grid-bg + 装飾的でスクリム (半透明 + blur) がそのまま
//                 ハマる画面なので variant 既定の scrim でよい。
//                 ボタンは ctaPrimary (D-A 標準 CTA) に統一。
//                 古い言語「真のトリセツ ¥500」は既に Polish-D-B (Day 12) で
//                 排除済、「相互理解度」に統一済。
//
// セッション判定: getSession() のみ。owner_token があれば diagnosed 扱い
// (createSession は type_id 必須のため、有効 session ≒ 診断済)。

import Link from "next/link";
import { getSession } from "@/lib/session";
import { StickyCtaFooter, ctaPrimary } from "./StickyCtaFooter";

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
      return { label: "他己診断テストへ", href: "/friend-evaluation" };
  }
}

export default async function FloatingCTABar() {
  const state = await detectState();
  const button = buttonFor(state);

  return (
    <StickyCtaFooter>
      <Link href={button.href} className={ctaPrimary}>
        {button.label}
      </Link>
    </StickyCtaFooter>
  );
}
