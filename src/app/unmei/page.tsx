import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import UnmeiCheckoutButton from "@/components/uranai/UnmeiCheckoutButton";
import UnmeiClient from "@/components/uranai/UnmeiClient";
import UnmeiReading from "@/components/uranai/UnmeiReading";
import { isReadingReady } from "@/lib/unmei/reading";

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

  // 購入済み: 出生データの有無で分岐
  const { data: profile } = await supabaseAdmin
    .from("birth_profiles")
    .select("user_id")
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

  // 購入済み・生成完了 → 鑑定表示 (整形版)
  return <UnmeiReading reading={reading!.reading} />;
}
