// タコ個別ページ /tako/[token]/friend/[perceptionId] の「非本人向け案内ページ」。
// 本人 (isOwner) 以外 — 評価してくれた友達 / owner_token URL を共有された第三者 — が
// アクセスしたとき、中身 (相互理解・ギャップ・贈りもの全文等) を一切見せず、
// 「診断してくれてありがとう / あなたも診断してみない?」の感謝 + 誘い画面を出す。
// 締め出しではなく、評価者を新規診断・ログインへ誘導する拡散導線にする。
// 世界観は /me・/tako・評価者ページと統一 (白背景・M PLUS Rounded(global)・ネイビー見出し・共通トークン)。

import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { GuideDiagnoseButton } from "./GuideDiagnoseButton";
import { TakoValueSections } from "./TakoValueSections";

export function FriendIndividualGuide({
  // 診断CTAの遷移先。評価者ページは ?source=<owner invite_code> を付けてバイラル計測を維持。
  // 未指定 (個別ページの案内) は素の /diagnosis = 従来挙動。
  diagnoseHref = "/diagnosis",
  // 指定時のみ診断CTAクリックを friend_to_diagnosis_clicked で計測 (評価者→診断の転換KPI)。
  diagnoseTrackSource,
}: {
  diagnoseHref?: string;
  diagnoseTrackSource?: string;
} = {}) {
  return (
    <>
      {/* ヘッダーは常時表示 (TopHeader 自体が sticky top-0)。スクロール連動の非表示はしない。 */}
      <TopHeader />
      <main
        className="relative overflow-x-clip px-4 pb-16 md:px-8"
        style={{ background: "#FFFFFF" }}
      >
        {/* ヒーロー: 左=見出し / 右=イラスト動画 (aisho FV と同じ文法)。
            SP は縦積み (見出し→動画)。動画は /aisho/hero-loop.mp4 を流用。 */}
        <section className="mx-auto max-w-[1080px] pt-6 md:pt-12 md:flex md:items-center md:gap-12">
          <div className="md:flex-1 text-center md:text-left">
            <h1 className="text-[#2E2E5C] font-black text-[29px] md:text-[40px] leading-[1.4]">
              診断してくれて、
              <br />
              ありがとう。
            </h1>
            <p className="mt-3 text-[#8A8AA3] font-bold text-[13px] md:text-base leading-relaxed">
              あなたの回答が、
              <br className="md:hidden" />
              相手のトリセツを完成させます。
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

        {/* ヒーロー下: 他己診断の案内ページ (tako ロック空状態) と同じ価値説明セクション。
            「こんなことが見えます」4項目グリッド + 進み方 3ステップ。 */}
        <div className="mx-auto max-w-[1080px] pt-12 md:pt-16">
          <TakoValueSections stepsFirst />
        </div>

        {/* CTA: 性格診断する (単独) */}
        <div className="relative z-10 mx-auto flex max-w-[420px] flex-col items-center pt-2 md:pt-4">
          <div className="w-full max-w-[320px]">
            <GuideDiagnoseButton
              href={diagnoseHref}
              trackSource={diagnoseTrackSource}
            >
              性格診断する
            </GuideDiagnoseButton>
          </div>
        </div>
      </main>
      {/* サイト共通フッター */}
      <TopFooter />
    </>
  );
}
