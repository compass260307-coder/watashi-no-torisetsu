// Phase 1.5-α Day 12-C1: 友達評価結果ページ (軸2 のメイン画面)
//
// 役割: 友達 (B) が A に対して 30 問の評価を完了した後、A (owner) が見るための画面。
// Day 12-Polish-E で相互理解度を完全無料化し、課金ゲートを撤去。
// Day 12 コンテンツ再設計で 7 セクション → 4 セクションに圧縮 (バイラル特化):
//   ヒーロー → ①◯◯さんから見たアナタ → ②ギャップ(TOP2フル+3圧縮) →
//   ③◯◯さんが見つけたアナタ(強み3+あれっ?3) → ④ふたりの関係 → ブーストCTA
//
// Server Component:
//   - perception (friend_perceptions) 取得
//   - target user (= A) 取得して自己 Big Five と displayName を確保
//   - session で isOwner 判定 (非 owner は /evaluate/sent へリダイレクト)
//   - 相互理解度 % + 5 次元ギャップを派生して描画
//
// 旧⑤「4つの特性」/ 旧⑦「友達視点の取扱説明書」はページから削除 (Day 12 再設計)。
// コンポーネント・生成ロジック・文章データは Stripe コード同様、後日の
// 「有料深掘りレポート」用に温存 (参照だけ外した):
//   - 章レイアウト: src/components/result/EvaluationChapters.tsx
//   - 4特性: src/lib/mutual-result-content.ts (FOUR_TRAITS / fourTraitBody)
//   - 取説B視点: src/lib/mutual-result-content.ts (getOwnerManual / MANUAL_BY_TYPE)
//   - 関係性アドバイス部品: src/lib/mutual-result-content.ts (adviceFor / honneFor)
//   - 強み/あれっ? の残り3つずつ: src/lib/mutual-result-content.ts (PERCEIVED_BY_TYPE)
//
// 課金ゲート撤去メモ:
//   - このページの unlock 分岐 (UnlockCard / UnlockConfirming / isPerceptionUnlocked) を撤去。
//   - 旧・解除カードの位置は PerceptionBoostCta (バイラル導線) に置き換え。
//   - Stripe インフラ (lib/perception-unlock, create-perception-unlock-session,
//     webhook/stripe, payment_history) は後の有料機能流用のため温存 (このページから参照しないだけ)。
//
// 触らない:
//   - friend_perceptions / users / payment_history のスキーマ
//   - Stripe 決済インフラ (API ルート / webhook / perception-unlock lib)
//   - /api/friend-answer/v2 (既に perceived_scores を保存している、Day 12-B 調査済)
//   - /me/[token] の本体構造 (Day 11.x 完成、本 PR では perceptions リンク追加のみ)
//   - LP / /diagnosis / /friend-evaluation の構造

import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { hasFullAccess } from "@/lib/entitlements";
import { sixteenTypes } from "@/lib/sixteen-types";
import { type BigFiveScores } from "@/lib/perception-analysis";
import { baseIdOf, nAxisOf, type ThirtyTwoTypeId } from "@/lib/thirty-two-types";
import { buildPerceptionView } from "@/lib/perception-view";
import { PerceptionResultBody } from "@/components/result/PerceptionResultBody";

// 課金ゲート撤去 (相互理解度を完全無料化): このページの unlock 分岐を外し、全章を無条件表示。
// Stripe インフラ (lib/perception-unlock, /api/checkout/create-perception-unlock-session,
// /api/webhook/stripe, payment_history) は後の有料機能流用のため温存し、ここでは参照しない。

export const metadata: Metadata = {
  title: "友達評価の結果",
  // perception id は推測困難だが、誤共有時の漏洩経路を絞るため noindex
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ perceptionId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// 本番DBを介さずデザイン確認するための行の最小形 (実DB行 / プレビュー用モック 共通)。
type PerceptionRow = {
  id: string;
  target_user_id: string;
  perceiver_name: string | null;
  perceived_type_id: string | null;
  perceived_full_code: string | null;
  perceived_modifier_label: string | null;
  perceived_scores: unknown;
  perceived_facet_scores: unknown;
  qualitative_data: unknown;
  created_at: string | null;
};
type EvalUserRow = {
  id: string;
  type_id: string | null;
  scores: unknown;
  display_name: string | null;
  owner_token: string | null;
  invite_code: string | null;
};

// 相互理解度・見出し・pinkify・各セクションの描画は共有ボディ (PerceptionResultBody) へ移設。

export default async function EvaluationResultPage({
  params,
  searchParams,
}: PageProps) {
  const { perceptionId } = await params;
  const sp = await searchParams;
  // 相互理解度は完全無料 (課金ゲートなし。Stripe インフラは温存・ここでは参照しない)

  // ===== プレビュー (実DB/session を介さずモックでデザイン確認) =====
  // ?previewType=<32タイプID> 指定時、そのタイプの High/Low モックで描画 (実ユーザーデータ不参照)。
  // 許可条件は dev または /preview 経由 (fromPreview=1)。owner ゲートもスキップ。
  const rawPreview = typeof sp.previewType === "string" ? sp.previewType : "";
  const previewAllowed =
    process.env.NODE_ENV !== "production" || sp.fromPreview === "1";
  const previewType: ThirtyTwoTypeId | null =
    previewAllowed &&
    /^[a-z-]+__[NR]$/.test(rawPreview) &&
    sixteenTypes[baseIdOf(rawPreview as ThirtyTwoTypeId)]
      ? (rawPreview as ThirtyTwoTypeId)
      : null;

  let perception: PerceptionRow | null;
  let user: EvalUserRow | null;

  if (previewType) {
    const code = sixteenTypes[baseIdOf(previewType)].code;
    const hi = (ax: string) => (code.includes(`${ax}＋`) ? 8 : 2);
    const clamp = (v: number) => Math.max(0, Math.min(10, v));
    const perceivedScores = {
      O: hi("O"),
      C: hi("C"),
      E: hi("E"),
      A: hi("A"),
      N: nAxisOf(previewType) === "N" ? 8 : 2,
    };
    // 自己スコアは少しずらしてギャップが見えるように。
    const selfMock = {
      O: clamp(perceivedScores.O - 3),
      C: perceivedScores.C,
      E: clamp(perceivedScores.E + 3),
      A: clamp(perceivedScores.A - 2),
      N: perceivedScores.N,
    };
    perception = {
      id: "preview",
      target_user_id: "preview",
      perceiver_name: "たっきん",
      perceived_type_id: null,
      perceived_full_code: null,
      perceived_modifier_label: null,
      perceived_scores: perceivedScores,
      perceived_facet_scores: null,
      qualitative_data: {
        favorite_point: "いつも落ち着いてて頼れるところ",
        animal: "ふくろう",
        impression_scene: "みんなが慌ててる時に一人だけ冷静だった",
      },
      created_at: null,
    };
    user = {
      id: "preview",
      type_id: null,
      scores: selfMock,
      display_name: "ゆうわインド",
      owner_token: "preview",
      invite_code: "preview",
    };
  } else {
    // ===== 1. perception 取得 (owner 自己診断スコアは含まない) =====
    const { data: pRow, error: pErr } = await supabaseAdmin
      .from("friend_perceptions")
      .select(
        "id, target_user_id, perceiver_name, perceived_type_id, perceived_full_code, perceived_modifier_label, perceived_scores, perceived_facet_scores, qualitative_data, created_at",
      )
      .eq("id", perceptionId)
      .maybeSingle();
    if (pErr) {
      console.error("[/evaluate/result] perception lookup error:", pErr);
    }
    if (!pRow) {
      notFound();
    }
    perception = pRow as PerceptionRow;

    // ===== 2. owner ゲート (Polish-H: プライバシー穴塞ぎ) =====
    // このページは owner (= 評価された本人 A) の自己診断スコア (レーダー/バー) を
    // 表示するため、owner 本人だけに見せる。owner 識別は cookie ベース session
    // (wn_session, httpOnly, server-readable) で判定する。
    //
    // フェイルクローズ: session 不在 / session.id が perception.target_user_id と
    // 一致しない (= 評価した友達や第三者、判定不可) 場合はすべて非 owner 扱いとし、
    // owner の自己スコアを「取得する前に」/evaluate/sent (友達セーフ版) へリダイレクト。
    // これにより非 owner の端末へ自己診断スコアが一切送信されない。
    const session = await getSession();
    const isOwner =
      !!session && session.id === (perception.target_user_id as string);
    if (!isOwner) {
      redirect(`/evaluate/sent/${perceptionId}`);
    }

    // ===== 課金ゲート (PR2: 個人詳細と同じ AND ゲート) =====
    // /evaluate/result は個別ページと同じ本文 (perception詳細・owner_message全文) を出す
    // 経路。owner がここを開けば課金導線を回避できる抜け道 (paywall-leak ④) になるため、
    // 未課金 owner は本文をロードする前に自分のトリセツ (課金導線) へ離脱させる。フェイルクローズ。
    if (!(await hasFullAccess(perception.target_user_id as string))) {
      const { data: ownerRow } = await supabaseAdmin
        .from("users")
        .select("owner_token")
        .eq("id", perception.target_user_id)
        .maybeSingle();
      const ownerToken = ((ownerRow?.owner_token as string | null) ?? "").trim();
      redirect(ownerToken ? `/me/${ownerToken}?paywall=1` : `/?paywall=1`);
    }

    // ===== 3. target user (= 評価された A) 取得 (owner 確定後にのみ self scores を取得) =====
    const { data: uRow } = await supabaseAdmin
      .from("users")
      .select("id, type_id, scores, display_name, owner_token, invite_code")
      .eq("id", perception.target_user_id)
      .maybeSingle();
    if (!uRow) {
      notFound();
    }
    user = uRow as EvalUserRow;
  }

  // 型ナローイング (プレビュー/実データ双方で以降 non-null が保証される)。
  if (!perception || !user) {
    notFound();
  }

  // ===== 4. 派生計算 (評価者1人分 → 表示データ。/tako 個別ページと共有) =====
  const selfScores = (user.scores ?? {}) as BigFiveScores;
  const otherScores = (perception.perceived_scores ?? {}) as BigFiveScores;
  const view = buildPerceptionView({
    selfScores,
    otherScores,
    perceiverName: perception.perceiver_name as string | null,
    ownerDisplayName: user.display_name as string | null,
    ownerToken: user.owner_token as string | null,
    qualitative:
      (perception.qualitative_data as Record<string, string> | null) ?? null,
  });

  return (
    <main
      className="relative min-h-dvh overflow-x-clip px-4 pb-10 md:px-8"
      style={{ background: "#FFFFFF" }}
    >
      <div className="relative z-10 mx-auto max-w-[560px] pt-6">
        {/* ===== ヘッダー (ロゴ) ===== */}
        <div className="flex justify-between items-center mb-5">
          <Link href="/" aria-label="トップへ">
            <Image
              src="/logo.png"
              alt="ワタシのトリセツ"
              width={280}
              height={80}
              priority
              className="w-[120px] h-auto"
            />
          </Link>
        </div>

        {/* ===== 相互理解ボディ (/tako 個別ページと共有) ===== */}
        <PerceptionResultBody
          view={view}
          selfScores={selfScores}
          otherScores={otherScores}
          variant="evaluate"
          footer={
            <div className="text-center pt-2 pb-2">
              <Link
                href={view.myTrisetsuUrl}
                className="text-[#2E2E5C]/60 font-bold text-sm underline hover:text-[#5B5BEF] transition-colors"
              >
                {view.displayName}のトリセツに戻る
              </Link>
            </div>
          }
        />
      </div>
    </main>
  );
}
