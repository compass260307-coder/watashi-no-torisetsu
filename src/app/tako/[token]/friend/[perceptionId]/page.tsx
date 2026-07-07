// 本人向け「友達ごとの個別ページ」 /tako/[token]/friend/[perceptionId]。
//   総合ページ /tako (友達平均) の「友達一覧」から降りてくる先。友達1人との相互理解を表示。
//   計算・描画は評価者完了ページ (/evaluate/result) と共有 (buildPerceptionView +
//   PerceptionResultBody variant="individual")。本人視点なので二人称は「あなた」、
//   相互理解度に「全体での位置づけ (順位)」を添え、友達のメッセージ/自由回答を主役級に。
//
// アクセス: owner_token (token) 所持で閲覧可 (/tako と同じ友達シェア前提)。
//   perceptionId は必ず token のユーザー宛て評価であることを確認 (別人の評価を出さない)。

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sixteenTypes } from "@/lib/sixteen-types";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import { baseIdOf, nAxisOf, type ThirtyTwoTypeId } from "@/lib/thirty-two-types";
import { buildPerceptionView } from "@/lib/perception-view";
import { PerceptionResultBody } from "@/components/result/PerceptionResultBody";
import { FriendIndividualGuide } from "@/components/result/FriendIndividualGuide";
import { getSession } from "@/lib/session";
import TopHeader from "@/components/top/TopHeader";
import { ScrollHideHeader } from "@/components/ScrollHideHeader";

export const metadata: Metadata = {
  title: "友達ごとの相互理解",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string; perceptionId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// 全体での位置づけ一言 (総合の全友達データ由来)。
function rankNote(rank: number, total: number, mutual: number): string {
  if (total <= 1) return "いまのところ、たった一人の大事な視点。";
  if (rank === 1) return `${total}人の中で、いちばん分かり合えている相手。`;
  if (rank === total && mutual < 60)
    return `${total}人の中では意外な一面を見てくれている相手。`;
  return `${total}人中 ${rank}番目に分かり合えている相手。`;
}

type PerceptionRow = {
  id: string;
  target_user_id: string;
  perceiver_name: string | null;
  perceived_scores: unknown;
  qualitative_data: unknown;
};

export default async function FriendIndividualPage({
  params,
  searchParams,
}: PageProps) {
  const { token, perceptionId } = await params;
  const sp = await searchParams;

  const rawPreview = typeof sp.previewType === "string" ? sp.previewType : "";
  const previewAllowed =
    process.env.NODE_ENV !== "production" || sp.fromPreview === "1";
  const previewType: ThirtyTwoTypeId | null =
    previewAllowed &&
    /^[a-z-]+__[NR]$/.test(rawPreview) &&
    sixteenTypes[baseIdOf(rawPreview as ThirtyTwoTypeId)]
      ? (rawPreview as ThirtyTwoTypeId)
      : null;

  let selfScores: BigFiveScores;
  let otherScores: BigFiveScores;
  let perceiverName: string | null;
  let ownerDisplayName: string | null;
  let qualitative: Record<string, string> | null;
  let ownerMessage = "";
  let rank = 1;
  let total = 1;

  if (previewType) {
    const code = sixteenTypes[baseIdOf(previewType)].code;
    const hi = (ax: string) => (code.includes(`${ax}＋`) ? 8 : 2);
    const clamp = (v: number) => Math.max(0, Math.min(10, v));
    otherScores = {
      O: hi("O"),
      C: hi("C"),
      E: hi("E"),
      A: hi("A"),
      N: nAxisOf(previewType) === "N" ? 8 : 2,
    };
    selfScores = {
      O: clamp(otherScores.O! - 3),
      C: otherScores.C,
      E: clamp(otherScores.E! + 3),
      A: clamp(otherScores.A! - 2),
      N: otherScores.N,
    };
    perceiverName = "たっきん";
    ownerDisplayName = "ゆうわインド";
    qualitative = {
      favorite_point: "いつも落ち着いてて頼れるところ",
      animal: "ふくろう",
      impression_scene: "みんなが慌ててる時に一人だけ冷静だった",
    };
    ownerMessage = "評価おわったよ！いつも助かってます。またごはん行こ〜";
    rank = 1;
    total = 3;
  } else {
    // owner (token) 取得
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, scores, display_name, owner_token")
      .eq("owner_token", token)
      .maybeSingle();
    if (!user) notFound();

    // ===== 本人ゲート (セキュリティ監査②前半: 個別ページは本人限定) =====
    // 個別ページは本人のプライベートな深掘り (相互理解・ギャップ・贈りもの全文)。
    // owner_token URL を踏んだだけの友達/第三者には中身を一切見せず、案内ページへ。
    // 判定は owner_token の有無ではなく、session が本人と一致するか (isOwner) で行う。
    // フェイルクローズ: session 不在 / 不一致はすべて非 owner 扱いとし、perception や
    // 贈りものを「取得する前に」案内ページを返す (非 owner の端末へ中身を一切送らない)。
    const session = await getSession();
    const isOwner = !!session && session.id === (user.id as string);
    if (!isOwner) {
      return <FriendIndividualGuide />;
    }

    selfScores = (user.scores ?? {}) as BigFiveScores;
    ownerDisplayName = (user.display_name as string | null) ?? null;

    // 対象 perception (このユーザー宛てであることを厳格に確認)
    const { data: pRow } = await supabaseAdmin
      .from("friend_perceptions")
      .select("id, target_user_id, perceiver_name, perceived_scores, qualitative_data")
      .eq("id", perceptionId)
      .maybeSingle();
    const perception = pRow as PerceptionRow | null;
    if (!perception || perception.target_user_id !== (user.id as string)) {
      notFound();
    }
    otherScores = (perception.perceived_scores ?? {}) as BigFiveScores;
    perceiverName = perception.perceiver_name;
    qualitative =
      (perception.qualitative_data as Record<string, string> | null) ?? null;

    // 全友達の相互理解度で順位を出す (総合データ由来)。
    const { data: allRows } = await supabaseAdmin
      .from("friend_perceptions")
      .select("id, perceived_scores")
      .eq("target_user_id", user.id);
    const ranked = (allRows ?? [])
      .map((r) => ({
        id: r.id as string,
        mutual: calcMutualUnderstanding(
          buildDimensionGaps(
            selfScores,
            (r.perceived_scores ?? {}) as BigFiveScores,
          ),
        ),
      }))
      .sort((a, b) => b.mutual - a.mutual);
    total = ranked.length || 1;
    rank = Math.max(1, ranked.findIndex((r) => r.id === perceptionId) + 1);

    // owner_message (ひとこと) は best-effort (列未適用でも壊さない)。
    try {
      const { data: msgRow } = await supabaseAdmin
        .from("friend_perceptions")
        .select("owner_message")
        .eq("id", perceptionId)
        .maybeSingle();
      ownerMessage = ((msgRow?.owner_message as string | null) ?? "").trim();
    } catch {
      ownerMessage = "";
    }
  }

  const view = buildPerceptionView({
    selfScores,
    otherScores,
    perceiverName,
    ownerDisplayName,
    ownerToken: token,
    qualitative,
  });
  const mutual = calcMutualUnderstanding(
    buildDimensionGaps(selfScores, otherScores),
  );

  return (
    <>
      <ScrollHideHeader>
        <TopHeader />
      </ScrollHideHeader>
      <main
        className="relative min-h-dvh overflow-x-clip px-4 pb-10 md:px-8"
        style={{ background: "#FFFFFF" }}
      >
        <div className="relative z-10 mx-auto max-w-[560px] pt-4">
          {/* 総合ページ (友達一覧) への戻り導線 */}
          <Link
            href={`/tako/${token}`}
            className="inline-flex items-center gap-1 text-[#2A3A5C]/70 font-bold text-sm hover:text-[#2A3A5C] transition-colors mb-2"
          >
            ← みんなから見た自分に戻る
          </Link>

          <PerceptionResultBody
            view={view}
            selfScores={selfScores}
            otherScores={otherScores}
            variant="individual"
            youWord="あなた"
            rankNote={rankNote(rank, total, mutual)}
            ownerMessage={ownerMessage}
            footer={
              <div className="text-center pt-2 pb-2">
                <Link
                  href={`/tako/${token}`}
                  className="text-[#2E2E5C]/60 font-bold text-sm underline hover:text-[#5B5BEF] transition-colors"
                >
                  みんなから見た自分に戻る
                </Link>
              </div>
            }
          />
        </div>
      </main>
    </>
  );
}
