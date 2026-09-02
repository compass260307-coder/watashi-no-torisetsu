// ミッションページ (LINE内ブラウザ専用)。リッチメニュー「ミッション」の着地点。
//
// 友達診断の回答集めをスタンプカード化する: 1人/3人/5人の節目で
// 深掘り占い1回をプレゼント (受け取りはトークでテーマを送ると自動消化)。
// 進捗は friend_answers、受取状態は line_mission_reward の決定的IDイベントで判定。
// 本人確認は /line/plus と同じ署名付きパラメータ (LIFF経由でも発行される)。

import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";

import { hasLineEventOnce, recordLineEvent } from "@/lib/line-events";
import { verifyLinePlusToken } from "@/lib/line-plus";
import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "ミッション | ワタシのトリセツ",
  robots: { index: false, follow: false },
};

const LINE_TALK_URL = "https://line.me/R/ti/p/%40867domoo";

// 報酬キーは webhook (handleThemeFortune) の受取ロジックと対で保つこと
const MISSION_TIERS = [
  { min: 1, keySuffix: "", title: "友達1人の回答を集める" },
  { min: 3, keySuffix: ":m3", title: "友達3人の回答を集める" },
  { min: 5, keySuffix: ":m5", title: "友達5人の回答を集める" },
] as const;

function isPreviewBot(userAgent: string): boolean {
  return /bot|facebookexternalhit|line-poker|crawler|spider|preview/i.test(
    userAgent,
  );
}

function FallbackCard({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#faf7f2] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold tracking-widest text-stone-400">
          MISSION
        </p>
        <h1 className="mt-3 text-lg font-bold text-stone-800">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-stone-600">{body}</p>
        <a
          href={LINE_TALK_URL}
          className="mt-8 block w-full rounded-full bg-[#06C755] px-6 py-3 text-sm font-bold text-white"
        >
          LINEに戻る
        </a>
      </div>
    </main>
  );
}

export default async function LineMissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; e?: string; s?: string }>;
}) {
  const { u, e, s } = await searchParams;
  const lineUserId = u ?? "";
  const expiresAtMs = Number(e);
  const signature = s ?? "";

  if (!verifyLinePlusToken({ lineUserId, expiresAtMs, signature })) {
    return (
      <FallbackCard
        title="リンクの有効期限が切れています"
        body="Aliceとのトークで「ミッション」と送ると、新しいリンクが届きます。そこからもう一度開いてみてください。"
      />
    );
  }

  const { data: account } = await supabaseAdmin
    .from("line_accounts")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (!account?.user_id) {
    return (
      <FallbackCard
        title="まだ連携が済んでいないみたいです"
        body="診断結果とLINEを連携すると、ミッションに挑戦できるようになります。トークに6桁の連携コードを送ってくださいね。"
      />
    );
  }
  const userId = account.user_id;

  const [{ data: user }, { count }] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("invite_code, display_name")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("friend_answers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);
  const answers = count ?? 0;
  const claims = await Promise.all(
    MISSION_TIERS.map((tier) =>
      hasLineEventOnce("line_mission_reward", `${userId}${tier.keySuffix}`),
    ),
  );

  const userAgent = (await headers()).get("user-agent") ?? "";
  if (!isPreviewBot(userAgent)) {
    await recordLineEvent({
      eventName: "line_mission_page_viewed",
      metadata: { line_user_id: lineUserId, user_id: userId, answers },
    });
  }

  const inviteUrl = user?.invite_code
    ? `${resolveSiteUrl()}/friend/${user.invite_code}`
    : resolveSiteUrl();
  const shareText = `友達診断、答えてもらえたらうれしいな🙏\n${inviteUrl}`;
  const shareUrl = `https://line.me/R/share?text=${encodeURIComponent(shareText)}`;

  return (
    <main className="min-h-dvh bg-[#F4F1FB] pb-32">
      {/* ヘッダー: 星空の帯 (LPと同じ世界観) */}
      <section className="bg-gradient-to-b from-[#241A4F] to-[#4C3A8C] px-5 pb-16 pt-10 text-center">
        <p className="text-[12px] font-black tracking-[0.28em] text-[#FFD97A]">
          MISSION
        </p>
        <div className="relative mx-auto mt-3 h-20 w-20">
          <Image
            src="/mascot/hoshiyomi-alice-avatar-transparent.png"
            alt=""
            fill
            sizes="80px"
            className="object-contain"
            priority
          />
        </div>
        <h1 className="mt-3 text-[22px] font-black text-white">
          🎯 ミッション
        </h1>
        <p className="mt-2 text-[13px] font-bold text-white/70">
          友達の回答: {answers}人
        </p>
      </section>

      <div className="mx-auto w-full max-w-md space-y-4 px-5">
        <div className="-mt-8 space-y-4">
          {MISSION_TIERS.map((tier, index) => {
            const achieved = answers >= tier.min;
            const claimed = claims[index];
            const progress = Math.min(answers / tier.min, 1) * 100;
            return (
              <section
                key={tier.min}
                className={`rounded-2xl border bg-white p-5 shadow-[0_12px_34px_rgba(36,26,79,0.10)] ${
                  achieved && !claimed
                    ? "border-[#FFD97A] ring-2 ring-[#FFD97A]/60"
                    : "border-[#5B5BEF]/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-black text-[#2E2E5C]">
                      {tier.title}
                    </p>
                    <p className="mt-1 text-[12px] font-bold text-[#5B5BEF]">
                      🎁 深掘り占い 1回プレゼント
                    </p>
                  </div>
                  {claimed ? (
                    <span className="flex-none rounded-full bg-[#EDEAFB] px-3 py-1.5 text-[11px] font-black text-[#2E2E5C]/60">
                      ✅ 受取済み
                    </span>
                  ) : achieved ? (
                    <span className="flex-none rounded-full bg-[#FFD97A] px-3 py-1.5 text-[11px] font-black text-[#5C4300]">
                      🎁 受取OK!
                    </span>
                  ) : (
                    <span className="flex-none rounded-full bg-[#F4F1FB] px-3 py-1.5 text-[11px] font-black text-[#2E2E5C]/50">
                      {answers}/{tier.min}人
                    </span>
                  )}
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#EDEAFB]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#5B5BEF] to-[#7C5BEF]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {achieved && !claimed && (
                  <p className="mt-3 text-[12px] font-medium leading-relaxed text-[#2E2E5C]/65">
                    トークで「恋愛運」「友達運」「勉強運」のどれかを送ると、自動でプレゼントが使われます。
                  </p>
                )}
              </section>
            );
          })}
        </div>

        <p className="px-1 text-[12px] font-medium leading-relaxed text-[#2E2E5C]/55">
          友達診断は、友達に何問か答えてもらうと「まわりから見えているあなた」がわかるやつです。回答は何人分でも集められますよ。
        </p>
      </div>

      {/* 固定CTA: LINEの共有ピッカーで招待を送る */}
      <div className="fixed inset-x-0 bottom-0 border-t border-[#5B5BEF]/10 bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-md">
          <a
            href={shareUrl}
            className="block w-full rounded-xl bg-[#06C755] py-4 text-center text-[15px] font-black text-white transition-transform active:scale-95"
          >
            友達に招待リンクを送る
          </a>
        </div>
      </div>
    </main>
  );
}
