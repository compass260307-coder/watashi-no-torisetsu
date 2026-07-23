import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import UnmeiCheckoutButton from "@/components/uranai/UnmeiCheckoutButton";
import UnmeiClient from "@/components/uranai/UnmeiClient";
import UnmeiReading from "@/components/uranai/UnmeiReading";
import { isReadingReady } from "@/lib/unmei/reading";
import { computeMoonDailyArc } from "@/lib/unmei/moon-arc";
import { resolveUnmeiPromptInputs } from "@/lib/unmei/prompt-inputs";
import type { Chart } from "@/lib/unmei/chart-view";

export const metadata = {
  title: "運命の設計図",
};

// 購入完了直後にログイン状態が反映されるよう、都度サーバで状態を解決する。
export const dynamic = "force-dynamic";

export default async function UnmeiPage() {
  const session = await getSession();
  const userId: string | null = session ? session.id : null;

  // 未ログイン / 未購入: ティーザー + 購入導線
  let unmeiFlag = false;
  if (userId) {
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("unmei")
      .eq("id", userId)
      .maybeSingle();
    unmeiFlag = !!u?.unmei;
  }

  if (!unmeiFlag) {
    return (
      <main className="mx-auto max-w-[640px] px-6 py-12">
        <h1 className="mb-4 text-2xl font-black">運命の設計図</h1>
        <p className="mb-6">
          ホロスコープ出生図をもとに、性格診断と掛け合わせたAI鑑定をお届けします。エンタメ目的で提供します。
        </p>
        <p className="mb-4 font-bold">運命の設計図 ¥1,980</p>
        <UnmeiCheckoutButton ownerToken={session?.owner_token ?? null}>
          購入する
        </UnmeiCheckoutButton>
      </main>
    );
  }

  // 購入済み: 出生データの有無で分岐 (出生図ホイール用に birth_date / time_unknown も取得)
  const { data: profile } = await supabaseAdmin
    .from("birth_profiles")
    .select("user_id, birth_date, time_unknown")
    .eq("user_id", userId!)
    .maybeSingle();

  // 購入済み・出生データ未入力 → 入力フォーム
  if (!profile) {
    return <UnmeiClient initialState="no_birth" />;
  }

  const { data: reading } = await supabaseAdmin
    .from("natal_readings")
    .select("reading, model, generated_at")
    .eq("user_id", userId!)
    .maybeSingle();

  // 購入済み・出生データあり・生成中/無効キャッシュ → クライアントでポーリング (60秒でタイムアウト表示)
  if (!isReadingReady(reading)) {
    return <UnmeiClient initialState="pending" />;
  }

  // 出生図ホイール用データ: 計算済みチャート + (時刻不明時のみ) 月の日周範囲。
  // natal_charts は reading が ready なら必ず存在する (生成前に必ず計算するため)。欠損時は非表示。
  const { data: natal } = await supabaseAdmin
    .from("natal_charts")
    .select("chart")
    .eq("user_id", userId!)
    .maybeSingle();
  const chart = (natal?.chart ?? null) as Chart | null;
  const timeUnknown = profile.time_unknown === true;
  const moonArc =
    chart && timeUnknown
      ? computeMoonDailyArc(chart, profile.birth_date as string | null)
      : null;
  // 出生図の中央に置く 32タイプ称号 (essence)。scores から決定的に導出 (欠損時は null)。
  const { essence } = await resolveUnmeiPromptInputs(supabaseAdmin, userId!);

  // 購入済み・生成完了 → 鑑定表示 (整形版 + 出生図)
  return (
    <UnmeiReading
      reading={reading!.reading}
      chart={chart}
      timeUnknown={timeUnknown}
      moonArc={moonArc}
      essence={essence}
    />
  );
}
