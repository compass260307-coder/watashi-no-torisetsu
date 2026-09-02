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
import { fortuneStreak, hasTalkedToAlice } from "@/lib/line-missions";
import { verifyLinePlusToken } from "@/lib/line-plus";
import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "ミッション | ワタシのトリセツ",
  robots: { index: false, follow: false },
};

const LINE_TALK_URL = "https://line.me/R/ti/p/%40867domoo";
// トークを開いて「今日の占い」を入力済みにするリンク (送信は本人がタップ)
const LINE_FORTUNE_MESSAGE_URL = `https://line.me/R/oaMessage/%40867domoo/?${encodeURIComponent("今日の占い")}`;

// 報酬キーは webhook (handleThemeFortune) の受取ロジックと対で保つこと
const MISSION_TIERS = [
  { min: 1, keySuffix: "", title: "友達1人の回答を集める" },
  { min: 3, keySuffix: ":m3", title: "友達3人の回答を集める" },
  { min: 5, keySuffix: ":m5", title: "友達5人の回答を集める" },
] as const;

// SNS共有ミッション。idは共有API (?n=) とwebhookの節目キー (:x等) と対で保つこと
const SNS_MISSIONS = [
  {
    id: "x",
    missionNo: "04",
    title: "Xでシェアする",
    buttonClass: "bg-black",
    art: "/line/mission-04.webp",
    pos: "object-[center_45%]",
  },
  {
    id: "fb",
    missionNo: "05",
    title: "Facebookでシェアする",
    buttonClass: "bg-[#1877F2]",
    art: "/line/mission-05.webp",
    pos: "object-[center_55%]",
  },
  {
    id: "th",
    missionNo: "06",
    title: "Threadsでシェアする",
    buttonClass: "bg-black",
    art: "/line/mission-06.webp",
    pos: "object-[center_48%]",
  },
] as const;

type SnsMissionState = { shared: boolean; claimed: boolean; href: string };

// リテンションミッション。節目キー (:talk/:streak3) は webhook と line-missions.ts と対
type RetentionState = {
  talk: { achieved: boolean; claimed: boolean };
  streak: { days: number; achieved: boolean; claimed: boolean };
};

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
  searchParams: Promise<{
    u?: string;
    e?: string;
    s?: string;
    preview?: string;
    claimed?: string;
    x?: string;
    fb?: string;
    th?: string;
    talk?: string;
    streak?: string;
    days?: string;
  }>;
}) {
  const { u, e, s, preview, claimed, x, fb, th, talk, streak, days } =
    await searchParams;
  const lineUserId = u ?? "";
  const expiresAtMs = Number(e);
  const signature = s ?? "";

  // 開発時のみ: ?preview=<回答数>&claimed=<受取済みティア数>&x/fb/th/talk/streak=<0未/1達成/2受取済>
  // (&days=<占い連続日数>) でトークン・DB不要の見た目確認
  if (process.env.NODE_ENV === "development" && preview !== undefined) {
    const claimedCount = Number(claimed) || 0;
    const snsParams: Record<string, string | undefined> = { x, fb, th };
    const talkState = Number(talk) || 0;
    const streakState = Number(streak) || 0;
    return (
      <MissionsView
        answers={Number(preview) || 0}
        claims={MISSION_TIERS.map((_, i) => i < claimedCount)}
        inviteUrl={`${resolveSiteUrl()}/friend/PREVIEW`}
        sns={SNS_MISSIONS.map((m) => {
          const state = Number(snsParams[m.id]) || 0;
          return { shared: state >= 1, claimed: state >= 2, href: "#" };
        })}
        retention={{
          talk: { achieved: talkState >= 1, claimed: talkState >= 2 },
          streak: {
            days: streakState >= 1 ? 3 : Number(days) || 0,
            achieved: streakState >= 1,
            claimed: streakState >= 2,
          },
        }}
      />
    );
  }

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
  const [claims, snsFlags, talkDone, talkClaimed, streakInfo, streakClaimed] =
    await Promise.all([
      Promise.all(
        MISSION_TIERS.map((tier) =>
          hasLineEventOnce("line_mission_reward", `${userId}${tier.keySuffix}`),
        ),
      ),
      Promise.all(
        SNS_MISSIONS.flatMap((m) => [
          hasLineEventOnce("line_mission_sns_shared", `${userId}:${m.id}`),
          hasLineEventOnce("line_mission_reward", `${userId}:${m.id}`),
        ]),
      ),
      hasTalkedToAlice(lineUserId),
      hasLineEventOnce("line_mission_reward", `${userId}:talk`),
      fortuneStreak(lineUserId),
      hasLineEventOnce("line_mission_reward", `${userId}:streak3`),
    ]);

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
  const tokenQuery = `u=${encodeURIComponent(lineUserId)}&e=${expiresAtMs}&s=${encodeURIComponent(signature)}`;
  const sns = SNS_MISSIONS.map((m, i) => ({
    shared: snsFlags[i * 2],
    claimed: snsFlags[i * 2 + 1],
    href: `/api/line/missions/share?n=${m.id}&${tokenQuery}`,
  }));

  return (
    <MissionsView
      answers={answers}
      claims={claims}
      inviteUrl={inviteUrl}
      sns={sns}
      retention={{
        talk: { achieved: talkDone, claimed: talkClaimed },
        streak: {
          days: streakInfo.current,
          achieved: streakInfo.best >= 3,
          claimed: streakClaimed,
        },
      }}
    />
  );
}

function MissionsView({
  answers,
  claims,
  inviteUrl,
  sns,
  retention,
}: {
  answers: number;
  claims: boolean[];
  inviteUrl: string;
  sns: SnsMissionState[];
  retention: RetentionState;
}) {
  const shareText = `友達診断、答えてもらえたらうれしいな🙏\n${inviteUrl}`;
  const shareUrl = `https://line.me/R/share?text=${encodeURIComponent(shareText)}`;
  return (
    <main className="min-h-dvh bg-[#F4F1FB] pb-12">
      {/* ヒーロー: 夜空Alice原画の手紙・本のエリアを左寄せ構図で使う。
          コンテンツ列と同じ max-w-md に収める (全幅だとPC幅で構図が崩れるため) */}
      <section className="relative mx-auto h-[230px] w-full max-w-md overflow-hidden">
        <Image
          src="/line/alice-plus-hero.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[12%_58%]"
          priority
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-[#241A4F]/60 via-[#241A4F]/20 to-[#241A4F]"
        />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-7">
          <p className="text-[11px] font-black tracking-[0.32em] text-[#FFD97A]">
            MISSION
          </p>
          <h1 className="mt-1.5 text-[24px] font-black leading-snug text-white drop-shadow-[0_2px_10px_rgba(20,10,50,0.6)]">
            ミッションを達成して、
            <br />
            特典を受け取ろう
          </h1>
        </div>
      </section>

      {/* セクション間はカード影用のpb-6が既に効くので狭めに */}
      <div className="mx-auto w-full max-w-md space-y-1 px-5 pt-5">
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 px-1 text-[16px] font-black text-[#2E2E5C]">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rotate-45 bg-[#FFD97A]"
            />
            友達診断をしよう!
          </h2>
        {/* 正方形カードの横スクロール (1.5枚見せでスクロール可能なことを伝える)。
            上部はミッションごとの専用アート帯 (ChatGPT生成・回答=夜空の手紙:
            01=1通が届く → 02=3通が集まる → 03=Aliceが5通抱えて待つ) */}
        <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-6 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MISSION_TIERS.map((tier, index) => {
            const achieved = answers >= tier.min;
            const claimed = claims[index];
            const progress = Math.min(answers / tier.min, 1) * 100;
            const art = [
              { src: "/line/mission-01.webp", pos: "object-[center_45%]" },
              { src: "/line/mission-02.webp", pos: "object-[center_45%]" },
              { src: "/line/mission-03.webp", pos: "object-[center_38%]" },
            ][index];
            return (
              <section
                key={tier.min}
                className={`flex w-60 flex-none snap-center flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_18px_38px_rgba(36,26,79,0.22)] ${
                  achieved && !claimed
                    ? "border-[#FFD97A] ring-2 ring-[#FFD97A]/60"
                    : "border-[#5B5BEF]/10"
                }`}
              >
                <div className="relative h-[104px] flex-none">
                  <Image
                    src={art.src}
                    alt=""
                    fill
                    sizes="240px"
                    className={`object-cover ${art.pos} ${claimed ? "opacity-60 saturate-50" : ""}`}
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-[#241A4F]/70 via-transparent to-[#241A4F]/25"
                  />
                  <p className="absolute bottom-2.5 left-4 text-[10px] font-black tracking-[0.22em] text-[#FFD97A]">
                    {`MISSION 0${index + 1}`}
                  </p>
                  {claimed ? (
                    <span className="absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-black text-[#2E2E5C]/60">
                      受取済み
                    </span>
                  ) : achieved ? (
                    <span className="absolute right-3 top-3 rounded-full bg-[#FFD97A] px-3 py-1.5 text-[11px] font-black text-[#5C4300]">
                      受取OK!
                    </span>
                  ) : (
                    <span className="absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-black text-[#2E2E5C]/60">
                      {answers}/{tier.min}人
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5 pt-4">
                  <p className="text-[16px] font-black leading-snug text-[#2E2E5C]">
                    {tier.title}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-[#5B5BEF]">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rotate-45 bg-[#FFD97A]"
                    />
                    深掘り占い 1回プレゼント
                  </p>
                  <div className="mt-auto">
                    {achieved && !claimed ? (
                      <p className="text-[11px] font-medium leading-relaxed text-[#2E2E5C]/65">
                        トークで「恋愛運」などのテーマを送ると、自動で受け取れます
                      </p>
                    ) : !achieved ? (
                      <>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#EDEAFB]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#5B5BEF] to-[#7C5BEF]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <a
                          href={shareUrl}
                          className="mt-3 block w-full rounded-xl bg-[#06C755] py-3 text-center text-[13px] font-black text-white transition-transform active:scale-95"
                        >
                          友達に招待リンクを送る
                        </a>
                      </>
                    ) : (
                      <p className="text-[11px] font-medium leading-relaxed text-[#2E2E5C]/45">
                        受け取りありがとう。また友達が増えたら、次のミッションで会いましょう
                      </p>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 px-1 text-[16px] font-black text-[#2E2E5C]">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rotate-45 bg-[#FFD97A]"
            />
            SNSで共有しよう!
          </h2>
          {/* SNS共有ミッション: タップ=達成 (共有APIが記録→各SNSの投稿画面へ) */}
          <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-6 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SNS_MISSIONS.map((mission, index) => {
              const { shared, claimed, href } = sns[index];
              return (
                <section
                  key={mission.id}
                  className={`flex aspect-square w-60 flex-none snap-center flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_18px_38px_rgba(36,26,79,0.22)] ${
                    shared && !claimed
                      ? "border-[#FFD97A] ring-2 ring-[#FFD97A]/60"
                      : "border-[#5B5BEF]/10"
                  }`}
                >
                  <div className="relative h-[104px] flex-none">
                    <Image
                      src={mission.art}
                      alt=""
                      fill
                      sizes="240px"
                      className={`object-cover ${mission.pos} ${claimed ? "opacity-60 saturate-50" : ""}`}
                    />
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-t from-[#241A4F]/70 via-transparent to-[#241A4F]/25"
                    />
                    <p className="absolute bottom-2.5 left-4 text-[10px] font-black tracking-[0.22em] text-[#FFD97A]">
                      {`MISSION ${mission.missionNo}`}
                    </p>
                    {claimed ? (
                      <span className="absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-black text-[#2E2E5C]/60">
                        受取済み
                      </span>
                    ) : shared ? (
                      <span className="absolute right-3 top-3 rounded-full bg-[#FFD97A] px-3 py-1.5 text-[11px] font-black text-[#5C4300]">
                        受取OK!
                      </span>
                    ) : (
                      <span className="absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-black text-[#2E2E5C]/60">
                        未達成
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5 pt-4">
                    <p className="text-[16px] font-black leading-snug text-[#2E2E5C]">
                      {mission.title}
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-[#5B5BEF]">
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rotate-45 bg-[#FFD97A]"
                      />
                      深掘り占い 1回プレゼント
                    </p>
                    <div className="mt-auto">
                      {shared && !claimed ? (
                        <p className="text-[11px] font-medium leading-relaxed text-[#2E2E5C]/65">
                          トークで「恋愛運」などのテーマを送ると、自動で受け取れます
                        </p>
                      ) : claimed ? (
                        <p className="text-[11px] font-medium leading-relaxed text-[#2E2E5C]/45">
                          シェアありがとう。誰かの自己理解のきっかけになるかも
                        </p>
                      ) : (
                        <a
                          href={href}
                          className={`block w-full rounded-xl ${mission.buttonClass} py-3 text-center text-[13px] font-black text-white transition-transform active:scale-95`}
                        >
                          シェアする
                        </a>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 px-1 text-[16px] font-black text-[#2E2E5C]">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rotate-45 bg-[#FFD97A]"
            />
            Aliceと仲良くなろう!
          </h2>
          <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-6 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* MISSION 07: Aliceに話しかける (line_chat_messagesのuser行があれば達成) */}
            <section
              className={`flex w-60 flex-none snap-center flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_18px_38px_rgba(36,26,79,0.22)] ${
                retention.talk.achieved && !retention.talk.claimed
                  ? "border-[#FFD97A] ring-2 ring-[#FFD97A]/60"
                  : "border-[#5B5BEF]/10"
              }`}
            >
              <div className="relative h-[104px] flex-none">
                <Image
                  src="/line/mission-07.webp"
                  alt=""
                  fill
                  sizes="240px"
                  className={`object-cover object-[center_35%] ${retention.talk.claimed ? "opacity-60 saturate-50" : ""}`}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-[#241A4F]/70 via-transparent to-[#241A4F]/25"
                />
                <p className="absolute bottom-2.5 left-4 text-[10px] font-black tracking-[0.22em] text-[#FFD97A]">
                  MISSION 07
                </p>
                {retention.talk.claimed ? (
                  <span className="absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-black text-[#2E2E5C]/60">
                    受取済み
                  </span>
                ) : retention.talk.achieved ? (
                  <span className="absolute right-3 top-3 rounded-full bg-[#FFD97A] px-3 py-1.5 text-[11px] font-black text-[#5C4300]">
                    受取OK!
                  </span>
                ) : (
                  <span className="absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-black text-[#2E2E5C]/60">
                    未達成
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5 pt-4">
                <p className="text-[16px] font-black leading-snug text-[#2E2E5C]">
                  Aliceに話しかける
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-[#5B5BEF]">
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rotate-45 bg-[#FFD97A]"
                  />
                  深掘り占い 1回プレゼント
                </p>
                <div className="mt-auto">
                  {retention.talk.achieved && !retention.talk.claimed ? (
                    <p className="text-[11px] font-medium leading-relaxed text-[#2E2E5C]/65">
                      トークで「恋愛運」などのテーマを送ると、自動で受け取れます
                    </p>
                  ) : retention.talk.claimed ? (
                    <p className="text-[11px] font-medium leading-relaxed text-[#2E2E5C]/45">
                      これからもたくさん話しましょうね
                    </p>
                  ) : (
                    <a
                      href={LINE_TALK_URL}
                      className="block w-full rounded-xl bg-[#06C755] py-3 text-center text-[13px] font-black text-white transition-transform active:scale-95"
                    >
                      トークで話しかける
                    </a>
                  )}
                </div>
              </div>
            </section>

            {/* MISSION 08: 今日の占いを3日連続 (line_daily_fortunesの連続日数で達成) */}
            <section
              className={`flex w-60 flex-none snap-center flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_18px_38px_rgba(36,26,79,0.22)] ${
                retention.streak.achieved && !retention.streak.claimed
                  ? "border-[#FFD97A] ring-2 ring-[#FFD97A]/60"
                  : "border-[#5B5BEF]/10"
              }`}
            >
              <div className="relative h-[104px] flex-none">
                <Image
                  src="/line/mission-08.webp"
                  alt=""
                  fill
                  sizes="240px"
                  className={`object-cover object-[center_48%] ${retention.streak.claimed ? "opacity-60 saturate-50" : ""}`}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-[#241A4F]/70 via-transparent to-[#241A4F]/25"
                />
                <p className="absolute bottom-2.5 left-4 text-[10px] font-black tracking-[0.22em] text-[#FFD97A]">
                  MISSION 08
                </p>
                {retention.streak.claimed ? (
                  <span className="absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-black text-[#2E2E5C]/60">
                    受取済み
                  </span>
                ) : retention.streak.achieved ? (
                  <span className="absolute right-3 top-3 rounded-full bg-[#FFD97A] px-3 py-1.5 text-[11px] font-black text-[#5C4300]">
                    受取OK!
                  </span>
                ) : (
                  <span className="absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-black text-[#2E2E5C]/60">
                    {retention.streak.days}/3日
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5 pt-4">
                <p className="text-[16px] font-black leading-snug text-[#2E2E5C]">
                  今日の占いを3日連続で見る
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-[#5B5BEF]">
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rotate-45 bg-[#FFD97A]"
                  />
                  深掘り占い 1回プレゼント
                </p>
                <div className="mt-auto">
                  {retention.streak.achieved && !retention.streak.claimed ? (
                    <p className="text-[11px] font-medium leading-relaxed text-[#2E2E5C]/65">
                      トークで「恋愛運」などのテーマを送ると、自動で受け取れます
                    </p>
                  ) : retention.streak.claimed ? (
                    <p className="text-[11px] font-medium leading-relaxed text-[#2E2E5C]/45">
                      毎日の占い、これからも一緒に楽しみましょうね
                    </p>
                  ) : (
                    <>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#EDEAFB]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#5B5BEF] to-[#7C5BEF]"
                          style={{
                            width: `${Math.min(retention.streak.days / 3, 1) * 100}%`,
                          }}
                        />
                      </div>
                      <a
                        href={LINE_FORTUNE_MESSAGE_URL}
                        className="mt-3 block w-full rounded-xl bg-[#06C755] py-3 text-center text-[13px] font-black text-white transition-transform active:scale-95"
                      >
                        今日の占いを引く
                      </a>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
