// Phase 1.5-α Day 1: フローティング CTA バー (Cookie 状態認識)
//
// Server Component。getSession() で session を取得し、
// (1) ゲスト / (2) 自己診断済み / (3) 友達評価あり / (4) 統合トリセツ完成済
// の 4 状態に応じて主 / 副 2 ボタンを出し分ける。
//
// 実スキーマ準拠の差し替え (Brand v2 spec → 既存実装):
//   - 想定された users.result_json は存在しない
//     → getSession() が返れば「診断済」とみなす (createSession は type_id 必須のため)
//   - 想定された users.payment_status は存在しない
//     → integrated_trisetsu.status='completed' の存在で判定
//   - URL に使う token は users.owner_token (公開トークン)、
//     users.session_token (Cookie 値) は URL に出さない

import Link from "next/link";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

type CTAState =
  | { type: "guest" }
  | { type: "diagnosed"; token: string }
  | { type: "perceived"; token: string }
  | { type: "paid"; token: string; integratedId: string };

async function detectState(): Promise<CTAState> {
  const session = await getSession();
  if (!session) return { type: "guest" };
  // owner_token が無いセッション (理論上発生しないが防御) はゲスト扱い
  const ownerToken = session.owner_token;
  if (!ownerToken) return { type: "guest" };

  // 完成済 integrated_trisetsu があれば paid (Phase 1 では存在 = 課金済の proxy)
  const { data: integrated } = await supabaseAdmin
    .from("integrated_trisetsu")
    .select("id")
    .eq("user_id", session.id)
    .eq("status", "completed")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (integrated) {
    return {
      type: "paid",
      token: ownerToken,
      integratedId: integrated.id as string,
    };
  }

  // 友達評価の有無
  const { count } = await supabaseAdmin
    .from("friend_perceptions")
    .select("id", { count: "exact", head: true })
    .eq("target_user_id", session.id);

  if ((count ?? 0) >= 1) {
    return { type: "perceived", token: ownerToken };
  }

  return { type: "diagnosed", token: ownerToken };
}

interface CtaButton {
  label: string;
  href: string;
}

function buttonsFor(state: CTAState): { primary: CtaButton; secondary: CtaButton } {
  switch (state.type) {
    case "guest":
      return {
        primary: { label: "無料で診断する", href: "/diagnosis" },
        // ゲストには 32 タイプ図鑑をサンプルとして紹介 (zukan-mine は要 session)
        secondary: { label: "サンプルを見る", href: "/zukan/all" },
      };
    case "diagnosed":
      return {
        primary: {
          label: "友達に診断を頼む",
          href: `/me/${state.token}?tab=share`,
        },
        secondary: { label: "自分のトリセツ", href: `/me/${state.token}` },
      };
    case "perceived":
      return {
        primary: { label: "真のトリセツを作る ¥500", href: "/integrated/new" },
        secondary: { label: "自分のトリセツ", href: `/me/${state.token}` },
      };
    case "paid":
      return {
        primary: {
          label: "真のトリセツを見る",
          href: `/integrated/${state.integratedId}`,
        },
        secondary: { label: "自分のトリセツ", href: `/me/${state.token}` },
      };
  }
}

export default async function FloatingCTABar() {
  const state = await detectState();
  const { primary, secondary } = buttonsFor(state);

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[480px] z-50"
      style={{
        backgroundColor: "rgba(255, 249, 240, 0.95)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: "12px",
        borderRadius: "9999px",
        border: "2px solid #C8B7F0",
        boxShadow: "0 4px 16px rgba(58, 45, 107, 0.15)",
      }}
    >
      <div className="flex gap-2">
        <Link
          href={primary.href}
          className="flex-1 bg-[#FFE993] text-[#3A2D6B] py-3 px-4 rounded-full text-sm font-black text-center border-2 border-[#3A2D6B] truncate"
        >
          {primary.label}
        </Link>
        <Link
          href={secondary.href}
          className="flex-1 bg-white text-[#3A2D6B] py-3 px-4 rounded-full text-sm font-bold text-center border-2 border-[#3A2D6B] truncate"
        >
          {secondary.label}
        </Link>
      </div>
    </div>
  );
}
