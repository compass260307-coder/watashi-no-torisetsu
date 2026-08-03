// タコ個別ページ /tako/[token]/friend/[perceptionId] の「非本人向け案内ページ」。
// 本人 (isOwner) 以外 — 評価してくれた友達 / owner_token URL を共有された第三者 — が
// アクセスしたとき、中身 (相互理解・ギャップ・贈りもの全文等) を一切見せず、
// 「診断してくれてありがとう / あなたも診断してみない?」の感謝 + 誘い画面を出す。
// 締め出しではなく、評価者を新規診断・ログインへ誘導する拡散導線にする。
// 世界観は /me・/tako・評価者ページと統一 (白背景・M PLUS Rounded(global)・ネイビー見出し・共通トークン)。

import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import { GuideDiagnoseButton } from "./GuideDiagnoseButton";
import { TakoValueSections } from "./TakoValueSections";
import { ProofFacesBand } from "@/components/ProofFacesBand";
import { MeAttentionOnGuide } from "./MeAttentionOnGuide";
import { MeStickyHeader } from "./MeStickyHeader";
import type { ResultLocale } from "@/i18n/result";

export function FriendIndividualGuide({
  // 診断CTAの遷移先。評価者ページは ?source=<owner invite_code> を付けてバイラル計測を維持。
  // 未指定 (個別ページの案内) は素の /diagnosis = 従来挙動。
  diagnoseHref = "/diagnosis",
  // 指定時のみ診断CTAクリックを friend_to_diagnosis_clicked で計測 (評価者→診断の転換KPI)。
  diagnoseTrackSource,
  inviteCode,
  locale = "ja",
}: {
  diagnoseHref?: string;
  diagnoseTrackSource?: string;
  inviteCode?: string;
  locale?: ResultLocale;
} = {}) {
  const isKorean = locale === "ko";
  return (
    <>
      {/* 未診断の訪問者に下部ナビ「自己診断」の赤バッジを付与 (ja のみ。
          既存バッジ (tako/unmei) が ja 限定のため合わせる)。 */}
      {!isKorean && <MeAttentionOnGuide />}
      {/* ヘッダー + 直下の「自己診断をする」CTAバー (/me・/share のシェアバーと同じ流儀
          2026-08-04 指示)。スクロールでヘッダーが隠れてもバーは残る (MeStickyHeader)。
          計測は friend_to_diagnosis_clicked source=sticky_bar — ページ末尾CTA (sent_bottom)・
          下部ナビの赤バッジ (nav_badge) と source 別で比較できる。
          タコ個別ページの非本人向け案内 (diagnoseTrackSource 未指定) は従来どおり計測なし。 */}
      <MeStickyHeader
        showUnlockCta={false}
        diagnosisCta
        diagnosisCtaHref={diagnoseHref}
        diagnosisCtaLabel={isKorean ? "내 성격도 진단하기" : "自己診断をする"}
        diagnosisCtaTrackSource={diagnoseTrackSource ? "sticky_bar" : undefined}
        inviteCode={inviteCode}
        locale={locale}
      >
        {isKorean ? <KoTopHeader /> : <TopHeader />}
      </MeStickyHeader>
      <main
        className="relative overflow-x-clip px-4 pb-16 md:px-8"
        style={{ background: "#FFFFFF" }}
      >
        {/* ヒーロー: 左=見出し / 右=イラスト動画 (aisho FV と同じ文法)。
            SP は縦積み (見出し→動画)。動画は /aisho/hero-loop.mp4 を流用。 */}
        <section className="mx-auto max-w-[1080px] pt-6 md:pt-12 md:flex md:items-center md:gap-12">
          <div className="md:flex-1 text-center md:text-left">
            <h1 className="text-[#2E2E5C] font-black text-[29px] md:text-[40px] leading-[1.4]">
              {isKorean ? "진단에 참여해 줘서" : "診断してくれて、"}
              <br />
              {isKorean ? "고마워요." : "ありがとう。"}
            </h1>
            <p className="mt-3 text-[#8A8AA3] font-bold text-[13px] md:text-base leading-relaxed">
              {isKorean ? "당신의 답변으로" : "あなたの回答が、"}
              <br className="md:hidden" />
              {isKorean
                ? "친구의 사용설명서가 완성돼요."
                : "相手のトリセツを完成させます。"}
            </p>
          </div>
          <div className="mt-6 md:mt-0 md:w-[48%] md:max-w-[560px] md:shrink-0">
            {/* autoplay + muted + loop の生 video (クライアント化不要でオートプレイ可)。 */}
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden="true"
              className="w-full rounded-3xl object-cover"
            >
              <source src="/aisho/hero-loop.mp4" type="video/mp4" />
            </video>
          </div>
        </section>

        {/* 実績バンド: /unmei と同じ ProofFacesBand (中央に人数、周囲に笑顔アバター浮遊)。
            ヒーロー直下に置き、ページを開いてすぐ社会的証明が目に入るようにする (2026-08-04 指示)。
            人数は無料診断の累計完了者数 — この画面の CTA は自己診断 (/diagnosis) への誘いなので、
            友達回答数ではなく自己診断の数を社会的証明に使う。
            上下 padding は帯からはみ出す浮遊アバターの逃げ。
            文言が日本語固定のため ko では出さない (TakoLockedState と同じ扱い。KO対応は別作業)。
            人数の更新方法は ProofFacesBand のコメント参照。 */}
        {!isKorean && (
          <div className="mx-auto max-w-[1080px] pt-10 pb-6 md:pt-14 md:pb-8">
            <ProofFacesBand />
          </div>
        )}

        {/* ヒーロー下: 友達診断の案内ページ (tako ロック空状態) と同じ価値説明セクション。
            「こんなことが見えます」4項目グリッド + 進み方 3ステップ。 */}
        <div className="mx-auto max-w-[1080px] pt-12 md:pt-16">
          <TakoValueSections stepsFirst locale={locale} />
        </div>

        {/* CTA: 性格診断する (単独) */}
        <div className="relative z-10 mx-auto flex max-w-[420px] flex-col items-center pt-2 md:pt-4">
          <div className="w-full max-w-[320px]">
            <GuideDiagnoseButton
              href={diagnoseHref}
              trackSource={diagnoseTrackSource}
              inviteCode={inviteCode}
            >
              {isKorean ? "내 성격도 진단하기" : "性格診断する"}
            </GuideDiagnoseButton>
          </div>
        </div>
      </main>
      {/* サイト共通フッター */}
      {isKorean ? <KoTopFooter /> : <TopFooter />}
    </>
  );
}
