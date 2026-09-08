// /purchase-complete の成功画面ビュー (静的JSX)。
//
// 本番ページ (Stripe session 検証つき) と /dev/purchase-complete-preview
// (ローカルUI確認用・Stripe不要) の両方から使うため切り出している。
// 検証・計測 (MetaPurchaseDataLayer) はページ側の責務で、ここには置かない。

import Link from "next/link";
import { LoginCard } from "@/components/LoginCard";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import TopHeader from "@/components/top/TopHeader";
import type { ResultLocale } from "@/i18n/result";
import { HOSHIYOMI_CHAT_CREDITS_CURRENT_FULL_ACCESS } from "@/lib/access-products";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";

type PurchaseCompleteViewProps = {
  isGuestPurchase?: boolean;
  product?: "self_report" | "full_access" | "premium_bundle";
  destinyFeaturesIncluded?: boolean;
  hoshiyomiChatIncluded?: boolean;
  hoshiyomiChatCredits?: number;
  tarotFeaturesIncluded?: boolean;
  friendFeaturesIncluded?: boolean;
  locale?: ResultLocale;
};

export function PurchaseCompleteView({
  isGuestPurchase = false,
  product = "full_access",
  destinyFeaturesIncluded,
  hoshiyomiChatIncluded,
  hoshiyomiChatCredits,
  tarotFeaturesIncluded,
  friendFeaturesIncluded,
  locale = "ja",
}: PurchaseCompleteViewProps) {
  const isKo = locale === "ko";
  const reportName = isKo
    ? product === "self_report"
      ? "학생 플랜"
      : product === "premium_bundle"
        ? "프리미엄 코스"
        : "완전판 리포트"
    : product === "self_report"
      ? "学生向けプラン"
      : product === "premium_bundle"
        ? "全部入り"
        : "完全版レポート";
  const reportObjectParticle = isKo && product === "self_report" ? "을" : "를";
  const reportSubjectParticle = isKo && product === "self_report" ? "이" : "가";
  const hasDestinyFeatures =
    destinyFeaturesIncluded ?? product === "premium_bundle";
  // AI占い師チャットは設計図と独立。現行の日本版完全版と
  // プレミアムは30回、旧完全版は購入時の回数を維持する。
  // 旧呼び出し元がフラグ未指定のときは従来どおり設計図と同じ扱いに倒す。
  const hasHoshiyomiChat = hoshiyomiChatIncluded ?? hasDestinyFeatures;
  const includedChatCount = hasHoshiyomiChat
    ? (hoshiyomiChatCredits ?? HOSHIYOMI_CHAT_CREDITS_CURRENT_FULL_ACCESS)
    : 0;
  const hasTarotFeatures =
    tarotFeaturesIncluded ?? product === "premium_bundle";
  return (
    <>
    {/* サイト共通ヘッダー (/login の改良と揃える 2026-07-30 指示) */}
    {isKo ? <KoTopHeader /> : <TopHeader />}
    <main
      className="flex flex-1 flex-col items-center justify-center px-5 py-14"
      style={{ fontFamily: FONT_STACK, backgroundColor: "#F1F1F7" }}
    >
      <div className="mb-6 w-full max-w-[420px] text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-white"
          style={{ background: "#3FA96A" }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1
          className="text-[22px] font-black leading-[1.4]"
          style={{ color: NAVY }}
        >
          {isKo ? "구매해 주셔서 감사합니다!" : "購入ありがとうございます！"}
        </h1>
        <p
          className="mt-3 text-[13px] font-bold leading-[1.8]"
          style={{ color: "#8A8AA3" }}
        >
          {isGuestPurchase ? (
            isKo ? (
              <>
                결제에 사용한 이메일 주소로
                <br />
                바로 <span style={{ color: NAVY }}>로그인</span>할 수 있어요.
              </>
            ) : (
              <>
                購入に使ったメールアドレスで
                <br />
                そのまま<span style={{ color: NAVY }}>ログイン</span>できます。
              </>
            )
          ) : (
            isKo ? (
              <>
                결제에 사용한 이메일 주소로
                <br />
                나의 <span style={{ color: NAVY }}>{reportName}</span>
                {reportObjectParticle} 보내 드렸어요.
              </>
            ) : (
              <>
                購入に使ったメールアドレスに、
                <br />
                あなたの<span style={{ color: NAVY }}>{reportName}</span>
                をお届けしました。
              </>
            )
          )}
        </p>
        {/* 診断前に購入したゲスト向けの次の一歩。ログイン後は verify-magic-link が
            診断未完了アカウントを /diagnosis へ着地させる (2026-07-30)。 */}
        <p
          className="mt-2 text-[12px] font-bold leading-[1.8]"
          style={{ color: "#8A8AA3" }}
        >
          {isGuestPurchase ? (
            isKo ? (
              <>
                로그인 후 <span style={{ color: NAVY }}>무료 성격 진단</span>으로
                안내해 드려요.
                <br />
                진단이 끝나면 {reportName}{reportObjectParticle} 이메일로 보내 드립니다.
              </>
            ) : (
              <>
                ログイン後に<span style={{ color: NAVY }}>無料の性格診断</span>
                へご案内します。
                <br />
                診断が終わると、{reportName}をメールでお届けします。
              </>
            )
          ) : (
            isKo ? (
              <>
                아직 성격 진단을 하지 않았다면, 로그인 후 그대로
                <span style={{ color: NAVY }}>무료 성격 진단</span>으로 안내해
                드려요.
                <br />
                진단이 끝나면 {reportName}{reportSubjectParticle} 열립니다.
              </>
            ) : (
              <>
                性格診断がまだの場合は、ログイン後にそのまま
                <span style={{ color: NAVY }}>無料の性格診断</span>
                へご案内します。
                <br />
                診断が終わると、{reportName}が開きます。
              </>
            )
          )}
        </p>
      </div>

      {includedChatCount > 0 ? (
        <div className="mb-6 w-full max-w-[420px] rounded-2xl border border-[#DDDDF4] bg-white px-5 py-4 text-left">
          <p className="text-[13px] font-black text-[#2E2E5C]">
            {isKo
              ? "구매 후 이용할 수 있는 새로운 콘텐츠"
              : "購入後に使える新しいコンテンツ"}
          </p>
          <p className="mt-1 text-[12px] font-bold leading-[1.8] text-[#77778F]">
            {isKo ? (
              hasDestinyFeatures ? (
                <>
                  운명의 설계도와 나만의 전담 점성술사 채팅 {includedChatCount}회
                  {hasTarotFeatures ? ", 타로 세 종류" : ""}가 포함되어 있어요. 로그인 후
                  하단 메뉴의 「점성술사」에서 이용할 수 있습니다.
                </>
              ) : (
                <>
                  나만의 전담 점성술사 채팅 {includedChatCount}회가 포함되어
                  있어요. 로그인 후 하단 메뉴의 「점성술사」에서 이용할 수
                  있습니다.
                </>
              )
            ) : hasDestinyFeatures ? (
              <>
                運命の設計図、あなたの専属占い師とのチャット
                {includedChatCount}回分
                {hasTarotFeatures ? "、3種類のタロット占い" : ""}
                が含まれています。ログイン後、下部メニューの「占い師」から利用できます。
              </>
            ) : (
              <>
                あなたの専属AI占い師とのチャット{includedChatCount}
                回分が含まれています。ログイン後、下部メニューの
                「占い師」から利用できます。
              </>
            )}
          </p>
        </div>
      ) : null}

      {product === "self_report" && friendFeaturesIncluded ? (
        <div className="mb-6 w-full max-w-[420px] rounded-2xl border border-[#D7E9ED] bg-white px-5 py-4 text-left">
          <p className="text-[13px] font-black text-[#2E2E5C]">
            {isKo
              ? "친구 진단도 이용할 수 있어요"
              : "友達診断も利用できます"}
          </p>
          <p className="mt-1 text-[12px] font-bold leading-[1.8] text-[#77778F]">
            {isKo
              ? "두 번째 친구부터의 진단 결과와 여러 번 다시 만들 수 있는 친구 진단 분석 PDF가 열립니다."
              : "2人目以降の友達診断結果と、何度でも作り直せる他己分析PDFが解放されます。"}
          </p>
        </div>
      ) : null}

      {/* 購入直後にそのままログイン (magic link 発行)。届いたリンクから本人確認。 */}
      <LoginCard locale={locale} />

      {/* 返金の申請動線 (30日間の返金保証)。条件・手順は特商法ページに集約。 */}
      <p className="mt-6 max-w-[420px] text-center text-[12px] font-bold leading-[1.7] text-[#8A8AA3]">
        {isKo
          ? "30일 환불 보장이 포함되어 있어요. 환불을 원하시면 결제에 사용한 이메일 주소와 함께 "
          : "30日間の返金保証つき。返金をご希望の場合は、購入に使ったメールアドレスを添えて "}
        <a
          href="mailto:support@watashi-torisetsu.com"
          className="underline underline-offset-2"
          style={{ color: NAVY }}
        >
          support@watashi-torisetsu.com
        </a>
        {isKo ? "으로 연락해 주세요 (" : " までご連絡ください（"}
        <Link
          href={isKo ? "/ko/legal/commerce" : "/legal/commerce"}
          className="underline underline-offset-2"
          style={{ color: NAVY }}
        >
          {isKo ? "환불 조건" : "返金条件"}
        </Link>
        {isKo ? ")." : "）。"}
      </p>

      <Link
        href={isKo ? "/ko" : "/"}
        className="mt-6 text-center text-[12px] underline underline-offset-2 transition-colors hover:opacity-70"
        style={{ color: `${NAVY}80` }}
      >
        {isKo ? "홈으로 돌아가기" : "トップに戻る"}
      </Link>
    </main>
    </>
  );
}
