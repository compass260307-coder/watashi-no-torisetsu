import Link from "next/link";
import { redirect } from "next/navigation";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import {
  createMetaPurchaseClaimToken,
  verifyPaidMetaPurchaseCheckoutSession,
} from "@/lib/paid-checkout-session";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import UnmeiPriceCta from "@/components/uranai/UnmeiPriceCta";
import { hasUnmeiAccess } from "@/lib/entitlements";
import { SmoothImage } from "@/components/ui/SmoothImage";
import UnmeiClient from "@/components/uranai/UnmeiClient";
import UnmeiChatCheckoutGate from "@/components/uranai/UnmeiChatCheckoutGate";
import UnmeiPayPreview from "@/components/uranai/UnmeiPayPreview";
import UnmeiCheckoutConfirming from "@/components/uranai/UnmeiCheckoutConfirming";
import { ProofFacesBand } from "@/components/ProofFacesBand";
import UnmeiGuestPurchaseComplete from "@/components/uranai/UnmeiGuestPurchaseComplete";
import UnmeiReading from "@/components/uranai/UnmeiReading";
import UnmeiViewTracker from "@/components/uranai/UnmeiViewTracker";
import { isReadingReady } from "@/lib/unmei/reading";
import { computeMoonDailyArc } from "@/lib/unmei/moon-arc";
import { resolveUnmeiPromptInputs } from "@/lib/unmei/prompt-inputs";
import type { Chart } from "@/lib/unmei/chart-view";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata = {
  title: "運命の設計図",
  description:
    "星の配置をもとに、あなたがこれまで選んできた姿勢に名前をつけ、これからの選び方を考えるきっかけを届ける本格鑑定。性格診断とかけ合わせて、あなただけの運命の設計図を読み解きます。",
  alternates: localizedAlternates("ja", "/unmei", "/ko/unmei"),
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

// ?preview=ready で出生図ホイールも確認できるよう、実データ相当のサンプルチャート。
// 値は架空 (時刻既知で ASC/MC あり・アスペクト線が数本出る配置)。
const PREVIEW_CHART: Chart = {
  planets: {
    sun: { sign: "Leo", degree: 15.2 },
    moon: { sign: "Pisces", degree: 3.4 },
    mercury: { sign: "Virgo", degree: 2.8 },
    venus: { sign: "Gemini", degree: 28.5 },
    mars: { sign: "Virgo", degree: 10.1 },
    jupiter: { sign: "Virgo", degree: 25.9 },
    saturn: { sign: "Cancer", degree: 18.3 },
  },
  asc: { sign: "Scorpio", degree: 12.0 },
  mc: { sign: "Leo", degree: 22.0 },
  houses_available: true,
  // 詳細データ表 (逆行/ハウスカスプ) は datetime_utc + location から描画時再計算するため、
  // プレビューでも列が埋まるようサンプルの出生日時・地点を持たせる (dev preview のみ)。
  datetime_utc: "1995-08-07T20:30:00.000Z",
  location: { latitude: 35.69, longitude: 139.69 },
};

// よくある質問 (16P 参考のアコーディオン。native <details> なので JS 不要)。
// 「当たる占い?」の回答がエンタメ目的の明示を兼ねる (LP本文からは表記を撤去済みのため)。
const UNMEI_FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "「運命の設計図」はどんなことに役立ちますか？",
    a: "生まれた瞬間の星の配置から、あなたが積み上げてきた素質・人との関わり方・これから訪れる転換点を読み解きます。性格診断の結果と掛け合わせるので、「診断でわかった自分」をもう一段深く理解するきっかけになります。",
  },
  {
    q: "占いの知識がなくても読めますか？",
    a: "はい。専門用語の羅列ではなく、あなたに語りかける文章でお届けします。明日から試せる小さな一歩も添えながら、4つの章で読み解きます。",
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

// 実績バンド (浮遊アバター + 人数 + スパークル) は ProofFacesBand に共有化
// (2026-08-02、/tako 待機ページにも設置するため)。人数の更新もそちらで行う。

// 未購入ティーザー (16P プレミアムキャリアキット風の商品LP / 2026-07-26 指示)。
// PC: 左=出生図イメージ / 右=商品名・説明・価格・CTA。SP: 縦積み。
// 日本版は現行の完全版、韓国版と運命権限のない旧完全版はプレミアムに含む。
// hasFull はログイン済みならサーバ判定、未ログインは UnmeiPriceCta が localStorage の
// owner_token から判定する (決済APIが最終検証するため表示用の判定でよい)。
function UnmeiTeaserLp({
  ownerToken,
  hasFull,
  trackView = true,
  launchChat = false,
  previewMode = false,
}: {
  ownerToken: string | null;
  hasFull: boolean;
  trackView?: boolean;
  /** true = 購入CTAでリダイレクトせず全画面チャット決済を起動する。 */
  launchChat?: boolean;
  /** devプレビューでは計測・保存・決済を実行しない。 */
  previewMode?: boolean;
}) {
  const purchaseProduct = hasFull ? "premium_bundle" : "full_access";
  return (
      <main className="overflow-x-clip bg-white">
        {trackView ? (
          <UnmeiViewTracker
            eventName="unmei_lp_view"
            ownerToken={ownerToken}
            state={hasFull ? "upgrade_eligible" : "standard"}
            product={purchaseProduct}
          />
        ) : null}
        {/* うっすら色帯 (16P 参考): ヒーロー背景をごく淡いプレミアムクリームにし、直下の
            「できること」カードが帯の境目に重なるようにする (2026-07-26 指示)。
            コンテナはフッター (TopFooter) と同じ「padding 外側 + 内側 max-w-[1080px]」。 */}
        <div className="bg-[#FFFBF2] px-4 pb-8 pt-6 md:px-8 md:pb-10 md:pt-10">
        <div className="mx-auto max-w-[1080px]">
          <section className="grid items-center gap-6 md:grid-cols-2 md:gap-10">
            {/* ヒーロー画像 (Aliceを主役にしたフェルトジオラマ調・背景透過) */}
            <SmoothImage
              src="/mascot/unmei-hero-alice-transparent.png"
              alt="天使Aliceを中心に、天球儀と星図を囲むフェルトの仲間たち"
              width={1448}
              height={1086}
              // SP はひと回り小さく + 左寄せでテキストと左端を揃える (16P 参考。2026-07-26 指示)
              className="h-auto w-full max-w-[320px] md:max-w-[480px]"
              priority
            />

            {/* SP も 16P 同様に左寄せ (2026-07-26 指示) */}
            <div className="text-left">
              <h1 className="leading-tight">
                <span className="block text-[28px] font-black text-[#2E2E5C] md:text-[34px]">
                  あなただけの
                </span>
                <span className="mt-1.5 inline-block rounded-xl bg-[#A36818] px-3 py-1 text-[34px] font-black text-white md:text-[42px]">
                  運命の設計図
                </span>
              </h1>
              <p className="mt-3 text-[15px] font-bold leading-relaxed text-[#2E2E5C]/70 md:text-[16px]">
                星の配置×性格診断で、あなた専用の鑑定書をつくりましょう。
              </p>
              <UnmeiPriceCta
                sessionOwnerToken={ownerToken}
                sessionHasFull={hasFull}
                launchChat={launchChat}
                previewMode={previewMode}
              />
            </div>
          </section>

        </div>
        </div>

        {/* 実績ストリップ: ヒーロー帯の下端を波エッジで白地へ切り替える (16P の
            締めCTAセクション参考 / 2026-08-02 指示)。波は帯色 #F7F7FE を塗った SVG を
            preserveAspectRatio="none" で全幅に伸ばす。以降フッターまで白地。
            中央に人数、周囲に笑顔のアバターがふわふわ浮かぶ。人数は無料診断の累計完了者数
            (運命の設計図の購入数ではない) — 計測集計の実数スナップショット (2026-08-02時点
            9,756人)。増える一方なので「以上」表記は常に正だが、定期的に最新値へ更新する。
            顔画像の出自と誤認対策・人数の更新は ProofFacesBand のコメント参照。 */}
        <div className="bg-white">
          <svg
            aria-hidden="true"
            viewBox="0 0 1440 48"
            preserveAspectRatio="none"
            className="block h-8 w-full md:h-12"
          >
            <path
              fill="#FFFBF2"
              d="M0,0 H1440 V22 C1320,44 1180,6 1040,18 C900,30 800,46 660,32 C520,18 440,42 300,38 C160,34 70,8 0,26 Z"
            />
          </svg>
          <div className="px-4 md:px-8">
          <ProofFacesBand />
          </div>
        </div>

        {/* 白いカード包みと下側の波・帯色の再開は廃止 (2026-08-02 指示)。
            ヒーロー帯の波エッジ以降はフッターまで白地が続き、タイルを直接置く。
            mt はストリップ下端からはみ出す浮遊アバターぶんの逃げも兼ねる */}
        <div className="mt-16 px-4 md:mt-24 md:px-8">
        <div className="mx-auto max-w-[1080px]">
          {/* ===== できること (4色タイル・PC 2×2 グリッド) ===== */}
          <section>
            <h2 className="mb-7 text-center text-[20px] font-black text-[#2E2E5C] md:mb-9 md:text-[26px]">
              運命の設計図でできること
            </h2>
            {/* 32タイプの4グループ色 (/types・相性と同じ空/海/陸/未知パレット) のタイルで
                ポップに。白丸アイコンバッジ + POINT スタンプ (トリセツ流のラベル使い)。 */}
            <ul className="grid gap-4 md:grid-cols-2 md:gap-6">
              {[
                {
                  // 出生図ホイール (下部ナビの運命タブと同モチーフ)
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
                      <path d="M12 3.5 19.36 16.25H4.64L12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                      <circle cx="12" cy="3.5" r="1.5" fill="currentColor" />
                      <circle cx="19.36" cy="16.25" r="1.5" fill="currentColor" />
                      <circle cx="4.64" cy="16.25" r="1.5" fill="currentColor" />
                    </svg>
                  ),
                  title: "世界にひとつ、あなたの出生図ホイール",
                  body: "生年月日・出生時間・出生地から、生まれた瞬間の空を再現。太陽や月をはじめとした天体の配置を、あなただけの一枚の設計図として描きます",
                  bg: "#E7DCFB",
                  dark: "#6C4EB8",
                },
                {
                  // 鑑定文 (書類 + 本文行)
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                      <path d="M14 2v5h5" />
                      <path d="M9 13h6M9 17h4" />
                    </svg>
                  ),
                  title: "AIが語りかける、4章の鑑定書",
                  body: "「あなたが積み上げてきたもの」「誰かといるときのあなた」「これから訪れる転換点」「最後にひとつだけ」の4章。占い用語の羅列ではなく、あなたに語りかける文章で、明日から試せる小さな一歩まで添えて読み解きます",
                  bg: "#BEF2F9",
                  dark: "#1D6E86",
                },
                {
                  // 掛け合わせ (重なる2つの円)
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="9" cy="12" r="5.8" />
                      <circle cx="15" cy="12" r="5.8" />
                    </svg>
                  ),
                  title: "性格診断 × 星、ふたつの答え合わせ",
                  body: "自己診断でわかった性格と星の素質を照らし合わせ、重なるところも少しのズレも含めて、あなたがこれまで選んできた姿勢に名前をつけます",
                  bg: "#D8F2C0",
                  dark: "#3F7A2E",
                },
                {
                  // 自分の原点 (コンパス)
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="8.5" />
                      <path d="m15.5 8.5-2 5-5 2 2-5z" />
                    </svg>
                  ),
                  title: "何度でも戻ってこられる、自分の原点",
                  body: "生まれた瞬間の星の配置は、時間が経っても変わりません。迷ったときに何度でも読み返せる、あなただけの原点として手元に残ります",
                  bg: "#FDEFB4",
                  dark: "#8F6B14",
                },
              ].map((f, i) => (
                <li
                  key={f.title}
                  className="rounded-2xl p-5 transition-transform md:p-7 md:hover:-translate-y-1"
                  style={{ background: f.bg }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white"
                      style={{ color: f.dark }}
                    >
                      {f.icon}
                    </span>
                    <span
                      className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-black tracking-[0.08em]"
                      style={{ color: f.dark }}
                    >
                      POINT 0{i + 1}
                    </span>
                  </div>
                  <p className="mt-3.5 text-[17px] font-black leading-snug text-[#2E2E5C] md:text-[18px]">
                    {f.title}
                  </p>
                  <p className="mt-1.5 text-[14px] font-normal leading-relaxed text-[#2E2E5C]/70 md:text-[15px]">
                    {f.body}
                  </p>
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

// ゲスト購入 (未ログインで ?checkout=success 着地) の完了画面。
// 鑑定は webhook が購入メールに紐付けて解放するため、同じメールでログインすれば
// 出生情報の入力に進める。/purchase-complete (完全版のゲスト着地) と同じ流儀で
// LoginCard をその場に置き、販売LPへ戻さない。
// Stripe 決済着地 (?checkout=success&session_id=) の Meta Purchase 計測。
// webhook 反映の速さで着地分岐 (確認中 / ゲスト完了 / 購入済み本文) が変わっても
// 計測が漏れないよう、本文の分岐前に一度だけ検証してマウントする。
async function UnmeiMetaPurchase(sp: {
  [key: string]: string | string[] | undefined;
}) {
  if (sp.checkout !== "success") return null;
  const session = await verifyPaidMetaPurchaseCheckoutSession(sp.session_id);
  if (
    !session ||
    (session.product !== "unmei" &&
      session.product !== "unmei_upgrade" &&
      session.product !== "premium_bundle" &&
      session.product !== "full_access")
  ) {
    return null;
  }
  return (
    <MetaPurchaseDataLayer
      checkoutSessionId={session.id}
      product={session.product}
      claimToken={createMetaPurchaseClaimToken(session.id)}
    />
  );
}

export default async function UnmeiPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  // 計測 (Stripe 検証) と本文描画は独立なので並列に進める。
  const [metaPurchase, body] = await Promise.all([
    UnmeiMetaPurchase(sp),
    UnmeiPageBody(sp),
  ]);
  if (!metaPurchase) return body;
  return (
    <>
      {metaPurchase}
      {body}
    </>
  );
}

async function UnmeiPageBody(sp: {
  [key: string]: string | string[] | undefined;
}) {
  const preview =
    process.env.NODE_ENV !== "production" && typeof sp.preview === "string"
      ? sp.preview
      : "";

  if (preview === "paid" || preview === "purchased") {
    return <UnmeiClient initialState="no_birth" />;
  }
  if (preview === "purchase") {
    // 未購入からの購入チャット (入力→Stripe Checkout→生成) の dev 確認用。
    return (
      <UnmeiClient
        initialState="no_birth"
        purchase={{ ownerToken: null, product: "full_access" }}
        previewMode
      />
    );
  }
  if (preview === "pay") {
    // Stripe-hosted Checkoutへ進む商品カードの単体プレビュー。
    return <UnmeiPayPreview />;
  }
  if (preview === "checkout-success") {
    // 決済完了後にチャットへ戻った状態の単体プレビュー。
    return <UnmeiCheckoutConfirming preview />;
  }
  if (preview === "pending") {
    return <UnmeiClient initialState="pending" />;
  }
  if (preview === "ready") {
    return (
      <UnmeiReading
        reading={PREVIEW_READING}
        chart={PREVIEW_CHART}
        essence="寄添者"
        characterSlug="jellyfish"
        identity={{
          // 寄添者 = sparkle-dolphin__N (画像 jellyfish_N)。character-32.ts の実データと一致。
          typeName: "きらめきクラゲ",
          catchphrase: "心に寄り添いながら、世界を知っていく。",
          groupLabel: "海",
          groupColor: "#8EC5E8",
        }}
        trackView={false}
      />
    );
  }
  if (preview === "teaser" || preview === "teaser_full") {
    // 未購入LPの確認用 (dev限定): ?preview=teaser / teaser_full
    return (
      <UnmeiTeaserLp
        ownerToken={null}
        hasFull={preview === "teaser_full"}
        trackView={false}
        previewMode
      />
    );
  }
  if (preview === "chat") {
    // チャット決済フローの確認用 (dev限定): LP → 「設計図を作成する →」で全画面チャット起動。
    return (
      <UnmeiChatCheckoutGate
        purchase={{ ownerToken: null, product: "full_access" }}
        previewMode
      >
        <UnmeiTeaserLp
          ownerToken={null}
          hasFull={false}
          trackView={false}
          launchChat
          previewMode
        />
      </UnmeiChatCheckoutGate>
    );
  }

  const session = await getSession();
  const userId: string | null = session ? session.id : null;

  // 未ログイン / 未購入は本文を返さない。URL直打ちや旧リンク経由も
  // 結果ページ（未診断はトップ）へ戻し、BottomNav の課金モーダルを開く。
  const purchased = userId ? await hasUnmeiAccess(userId) : false;

  // Stripe-hosted Checkout から戻ったら、Webhook の反映速度にかかわらず
  // いったんチャット形式の購入完了・鑑定生成中メッセージで受け止める。
  // 未ログインのゲスト購入だけは、従来どおりログイン案内を表示する。
  if (sp.checkout === "success") {
    return userId ? <UnmeiCheckoutConfirming /> : <UnmeiGuestPurchaseComplete />;
  }

  if (!purchased) {
    const returnPath = session?.owner_token
      ? `/me/${encodeURIComponent(session.owner_token)}`
      : "/";
    redirect(`${returnPath}#unlock-unmei`);
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
  // 出生図の中央に置く 32タイプ称号 (essence) と、表紙のキャラクター星座用の動物スラッグ。
  // scores から決定的に導出 (欠損時は null)。
  const { essence, animalSlug, identity } = await resolveUnmeiPromptInputs(
    supabaseAdmin,
    userId!,
    "ja",
  );

  // 購入済み・生成完了 → 鑑定表示 (整形版 + 出生図)
  return (
    <UnmeiReading
      reading={reading!.reading}
      chart={chart}
      timeUnknown={timeUnknown}
      moonArc={moonArc}
      essence={essence}
      characterSlug={animalSlug}
      identity={identity}
    />
  );
}
