import Link from "next/link";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import UnmeiPriceCta from "@/components/uranai/UnmeiPriceCta";
import { hasFullAccess } from "@/lib/entitlements";
import { SmoothImage } from "@/components/ui/SmoothImage";
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

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

const PREVIEW_READING = {
  hitokoto:
    "あなたの星は、やさしさをただの性格ではなく、世界との結び方として持っています。人に合わせる力と、自分の道を選ぶ力が同じ場所で息をしています。",
  sections: [
    {
      id: "haichi",
      title: "あなたという星の配置",
      body: "太陽は、あなたが何を大切にして生きるかを照らします。月は、ひとりになったときの心の戻り先を示します。この設計図では、外に見せる顔よりも、内側で何度も選び直してきたやさしさが強く出ています。\n\n性格診断が示す協調性の高さと、星の配置が語る受け取る力は、別々の道から同じことを言っています。あなたは人の気持ちを読むだけではなく、その場の空気を少しよくする方向へ自然に手を伸ばす人です。明日、誰かに合わせる前に、自分が本当はどうしたいかを一度だけ先に書き出す。",
    },
    {
      id: "kokoro",
      title: "心の天気",
      body: "月が示す心の天気は、静かな観察力です。にぎやかな場所にいても、あなたの内側では小さな違和感や温度差が細かく記録されています。だからこそ、人の言葉の裏にある疲れや寂しさにも早く気づきます。\n\nただ、その感度は自分の心にも向ける必要があります。星は、あなたが人に差し出す安心を、自分にも返すことを求めています。次に誰かの相談を受けたときは、終わったあとに五分だけ何も返さない時間を取れ。",
    },
    {
      id: "chosen",
      title: "挑戦の風向き",
      body: "ここからは少し戦略の話です。あなたの挑戦は、大きく見せることではなく、選ぶことから始まります。できることが多いぶん、頼まれた役割を全部引き受けると、自分の進みたい方向がぼやけます。\n\n星の素質と診断の結果には、少しズレもあります。もともとの星はもっと自由に試したがっていますが、あなたは関係を壊さない選び方をしてきました。その選択は弱さではありません。今週中に一度だけ、頼まれたことへ即答せず「考えてから返す」と言う。",
    },
    {
      id: "grace",
      title: "最後にひとつだけ",
      body: "星が示すのは、決められた運命ではありません。あなたが何度も選んできた姿勢に、名前をつけるための地図です。\n\n人にやさしくできるあなたが、自分にもやさしく戻ってくる。その往復が、あなたの設計図のいちばん美しい線です。",
    },
  ],
};

// よくある質問 (16P 参考のアコーディオン。native <details> なので JS 不要)。
// 「当たる占い?」の回答がエンタメ目的の明示を兼ねる (LP本文からは表記を撤去済みのため)。
const UNMEI_FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "「運命の設計図」はどんなことに役立ちますか？",
    a: "生まれた瞬間の星の配置から、あなたの素質・心の動き・挑戦の方向性を読み解きます。性格診断の結果と掛け合わせるので、「診断でわかった自分」をもう一段深く理解するきっかけになります。",
  },
  {
    q: "占いの知識がなくても読めますか？",
    a: "はい。専門用語の羅列ではなく、あなたに語りかける文章でお届けします。4つの章それぞれに、明日から試せる小さな一歩を添えています。",
  },
  {
    q: "購入後は何をすればいいですか？",
    a: "生年月日・出生時間・出生地を入力するだけで、約1分で鑑定が生成されます。出生時間がわからない場合でも生成できます。生成した鑑定はいつでも読み返せます。",
  },
  {
    q: "当たる占いですか？",
    a: "「運命の設計図」はエンタメ目的のコンテンツで、決められた未来を告げるものではありません。星の配置をもとに、あなたがこれまで選んできた姿勢に名前をつけ、これからの選び方を考えるきっかけをお届けします。",
  },
  {
    q: "返金はできますか？",
    a: (
      <>
        決済日から30日以内であれば、全額返金いたします。詳しくは
        <Link
          href="/legal/commerce"
          className="mx-0.5 font-bold text-[#5B5BEF] underline underline-offset-2"
        >
          特定商取引法に基づく表記
        </Link>
        をご覧ください。
      </>
    ),
  },
];

// 未購入ティーザー (16P プレミアムキャリアキット風の商品LP / 2026-07-26 指示)。
// PC: 左=出生図イメージ / 右=商品名・説明・価格・CTA。SP: 縦積み。
// 価格: 通常 ¥1,980 / 完全版 (¥499) 保有者は ¥1,480 (unmei_upgrade)。
// hasFull はログイン済みならサーバ判定、未ログインは UnmeiPriceCta が localStorage の
// owner_token から判定する (決済APIが最終検証するため表示用の判定でよい)。
function UnmeiTeaserLp({
  ownerToken,
  hasFull,
}: {
  ownerToken: string | null;
  hasFull: boolean;
}) {
  return (
      <main className="overflow-x-clip bg-white">
        {/* うっすら色帯 (16P 参考): ヒーロー背景をごく淡いインディゴにし、直下の
            「できること」カードが帯の境目に重なるようにする (2026-07-26 指示)。
            コンテナはフッター (TopFooter) と同じ「padding 外側 + 内側 max-w-[1080px]」。 */}
        <div className="bg-[#F7F7FE] px-4 pb-24 pt-8 md:px-8 md:pb-32 md:pt-14">
        <div className="mx-auto max-w-[1080px]">
          <section className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
            {/* ヒーロー画像 (フェルトジオラマ調・白背景。他ページの mascot と同じ流儀) */}
            <SmoothImage
              src="/mascot/unmei-hero.png"
              alt="天球儀と星図を囲む、星読みの装いをしたフェルトの動物たち"
              width={1200}
              height={900}
              // mix-blend-multiply: 白背景PNGの白を帯色に溶かす (白い矩形の縁を消す)
              // SP はひと回り小さく + 左寄せでテキストと左端を揃える (16P 参考。2026-07-26 指示)
              className="h-auto w-full max-w-[340px] mix-blend-multiply md:max-w-none"
              priority
            />

            {/* SP も 16P 同様に左寄せ (2026-07-26 指示) */}
            <div className="text-left">
              <h1 className="leading-tight">
                <span className="block text-[28px] font-black text-[#2E2E5C] md:text-[36px]">
                  あなただけの
                </span>
                <span className="mt-2 inline-block rounded-xl bg-[#5B5BEF] px-3.5 py-1 text-[33px] font-black text-white md:text-[44px]">
                  運命の設計図
                </span>
              </h1>
              <p className="mt-5 text-[16px] font-bold leading-relaxed text-[#2E2E5C]/70 md:text-[18px]">
                星の配置×性格診断で、あなた専用の鑑定書をつくりましょう。
              </p>
              <UnmeiPriceCta
                sessionOwnerToken={ownerToken}
                sessionHasFull={hasFull}
              />
            </div>
          </section>
        </div>
        </div>

        {/* 帯より下 (白地)。負マージンで「できること」カードを帯の境目に重ねる */}
        <div className="-mt-14 px-4 md:-mt-20 md:px-8">
        <div className="mx-auto max-w-[1080px]">
          {/* ===== できること (白カード + PC 2×2 グリッド / /me のアップセルカードと同素材) ===== */}
          <section className="rounded-[20px] border border-[#F0F1F8] bg-white px-6 py-10 shadow-[0_10px_40px_rgba(46,46,92,0.08)] md:px-12 md:py-12">
            <p className="mb-8 text-center text-[16px] font-bold text-[#2E2E5C]/60 md:text-[17px]">
              運命の設計図でできること
            </p>
            <ul className="grid gap-x-10 gap-y-7 md:grid-cols-2">
              {[
                {
                  // 出生図ホイール (下部ナビの運命タブと同モチーフ)
                  icon: (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
                      <path d="M12 3.5 19.36 16.25H4.64L12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                      <circle cx="12" cy="3.5" r="1.5" fill="currentColor" />
                      <circle cx="19.36" cy="16.25" r="1.5" fill="currentColor" />
                      <circle cx="4.64" cy="16.25" r="1.5" fill="currentColor" />
                    </svg>
                  ),
                  title: "あなただけの出生図ホイール",
                  body: "生年月日・出生時間・出生地から、生まれた瞬間の空を再現。太陽や月をはじめとした天体の配置を、あなただけの一枚の設計図として描きます",
                },
                {
                  // 鑑定文 (書類 + 本文行)
                  icon: (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                      <path d="M14 2v5h5" />
                      <path d="M9 13h6M9 17h4" />
                    </svg>
                  ),
                  title: "4章立てのAI鑑定文",
                  body: "星の配置・心の天気・挑戦の風向き・最後にひとつだけ。占い用語の羅列ではなく、あなたに語りかける文章で、明日から試せる小さな一歩まで添えて読み解きます",
                },
                {
                  // 掛け合わせ (重なる2つの円)
                  icon: (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="9" cy="12" r="5.8" />
                      <circle cx="15" cy="12" r="5.8" />
                    </svg>
                  ),
                  title: "性格診断との掛け合わせ",
                  body: "自己診断でわかった性格と星の素質を照らし合わせ、重なるところも少しのズレも含めて、あなたがこれまで選んできた姿勢に名前をつけます",
                },
                {
                  // 自分の原点 (コンパス)
                  icon: (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="8.5" />
                      <path d="m15.5 8.5-2 5-5 2 2-5z" />
                    </svg>
                  ),
                  title: "いつでも戻ってこられる、自分の原点",
                  body: "生まれた瞬間の星の配置は、時間が経っても変わりません。迷ったときに何度でも読み返せる、あなただけの原点として手元に残ります",
                },
              ].map((f) => (
                <li key={f.title} className="flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex w-9 flex-shrink-0 justify-center text-[#5B5BEF]"
                  >
                    {f.icon}
                  </span>
                  <div>
                    <p className="text-[17px] font-black leading-snug text-[#2E2E5C] md:text-[18px]">
                      {f.title}
                    </p>
                    <p className="mt-1 text-[15px] font-normal leading-relaxed text-[#2E2E5C]/65 md:text-[16px]">
                      {f.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* ===== よくある質問 (16P 参考 / native details アコーディオン) ===== */}
          <section className="mt-14 md:mt-20">
            <h2 className="mb-3 text-[24px] font-black text-[#2E2E5C] md:text-[28px]">
              よくある質問
            </h2>
            <div className="divide-y divide-[#E9E9F2] border-y border-[#E9E9F2]">
              {UNMEI_FAQS.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-bold text-[#2E2E5C] md:text-[17px] [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span
                      aria-hidden="true"
                      className="flex-shrink-0 text-[22px] font-black leading-none text-[#5B5BEF] transition-transform duration-200 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-5 pr-8 text-[15px] leading-relaxed text-[#2E2E5C]/70 md:text-[16px]">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </section>

        </div>
        </div>

        {/* ===== 返金保証 (白地。帯は 2026-07-26 指示で撤去し、FAQ との余白も詰めた) ===== */}
        <div className="mt-10 px-4 pb-14 md:mt-12 md:px-8 md:pb-16">
        <div className="mx-auto max-w-[1080px]">
          {/* ===== 返金保証の安心ブロック (16P「リスクなし、100%返金保証」参考) =====
              文言は特商法ページの実条件 (30日以内・全額) に合わせる。「理由を問わず」は
              うたわない (適用条件があるため)。 */}
          <section className="pb-4 text-center">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F4F4FE] text-[#5B5BEF]">
              {/* 返金サイクル (循環矢印 + ¥) */}
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20.5 9A9 9 0 0 0 5.6 5.6L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3.5 15a9 9 0 0 0 14.9 3.4L21 16" />
                <path d="M21 21v-5h-5" />
                <path d="m9.9 8.6 2.1 2.9 2.1-2.9" />
                <path d="M12 11.5v4.3" />
                <path d="M10.1 12.9h3.8" />
                <path d="M10.1 14.7h3.8" />
              </svg>
            </span>
            <h2 className="mt-5 text-[22px] font-black text-[#2E2E5C] md:text-[26px]">
              リスクなし、30日間の返金保証
            </h2>
            <p className="mx-auto mt-2.5 max-w-[640px] text-[14px] font-bold leading-relaxed text-[#2E2E5C]/65 md:text-[15px]">
              商品にご満足いただけなかった場合は、決済日から30日以内に
              <a
                href="mailto:support@watashi-torisetsu.com"
                className="mx-0.5 text-[#5B5BEF] underline underline-offset-2"
              >
                support@watashi-torisetsu.com
              </a>
              までご連絡ください。購入代金の全額を返金いたします。
            </p>
          </section>
        </div>
        </div>
      </main>
  );
}

export default async function UnmeiPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const preview =
    process.env.NODE_ENV !== "production" && typeof sp.preview === "string"
      ? sp.preview
      : "";

  if (preview === "paid" || preview === "purchased") {
    return <UnmeiClient initialState="no_birth" />;
  }
  if (preview === "pending") {
    return <UnmeiClient initialState="pending" />;
  }
  if (preview === "ready") {
    return <UnmeiReading reading={PREVIEW_READING} />;
  }
  if (preview === "teaser" || preview === "teaser_full") {
    // 未購入LPの確認用 (dev限定): ?preview=teaser (通常 ¥1,980) / teaser_full (¥1,480 表示)
    return <UnmeiTeaserLp ownerToken={null} hasFull={preview === "teaser_full"} />;
  }

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
    const sessionHasFull = userId ? await hasFullAccess(userId) : false;
    return (
      <UnmeiTeaserLp
        ownerToken={session?.owner_token ?? null}
        hasFull={sessionHasFull}
      />
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
