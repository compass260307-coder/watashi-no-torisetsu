import type { Metadata } from "next";
import Link from "next/link";
import { LoginCard } from "@/components/LoginCard";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import {
  createMetaPurchaseClaimToken,
  verifyPaidFullAccessCheckoutSession,
} from "@/lib/paid-checkout-session";

export const dynamic = "force-dynamic";

const NAVY = "#2E2E5C";

export const metadata: Metadata = {
  title: { absolute: "결제가 완료되었습니다 | 나의 사용설명서" },
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

function UnverifiedPurchasePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-[#F1F1F7] px-5 py-14 text-center">
      <h1 className="text-[22px] font-black" style={{ color: NAVY }}>
        결제 정보를 확인할 수 없었어요
      </h1>
      <p className="mt-3 max-w-[420px] text-[13px] font-bold leading-[1.8] text-[#8A8AA3]">
        Stripe 결제 완료 화면에서 돌아온 URL을 그대로 열어 주세요.
        <br />
        이미 결제했다면 구매에 사용한 이메일도 확인해 주세요.
      </p>
      <Link
        href="/ko"
        className="mt-6 text-[12px] underline underline-offset-2"
        style={{ color: `${NAVY}80` }}
      >
        홈으로 돌아가기
      </Link>
    </main>
  );
}

export default async function KoreanPurchaseCompletePage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const session = await verifyPaidFullAccessCheckoutSession(params.session_id);
  if (!session) return <UnverifiedPurchasePage />;
  const claimToken = createMetaPurchaseClaimToken(session.id);

  return (
    <>
      <MetaPurchaseDataLayer
        checkoutSessionId={session.id}
        claimToken={claimToken}
      />
      <main className="flex flex-1 flex-col items-center justify-center bg-[#F1F1F7] px-5 py-14">
      <div className="mb-6 w-full max-w-[420px] text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#3FA96A] text-white"
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
          구매해 주셔서 감사합니다!
        </h1>
        <p className="mt-3 text-[13px] font-bold leading-[1.8] text-[#8A8AA3]">
          결제에 사용한 이메일 주소로
          <br />
          <span style={{ color: NAVY }}>잠금 해제된 상세 결과 링크</span>를 보내
          드렸어요.
        </p>
      </div>

      <LoginCard locale="ko" />

      <p className="mt-6 max-w-[420px] text-center text-[12px] font-bold leading-[1.7] text-[#8A8AA3]">
        30일 환불 보장이 포함되어 있어요. 환불을 원하시면 결제에 사용한 이메일
        주소와 함께{" "}
        <a
          href="mailto:support@watashi-torisetsu.com"
          className="underline underline-offset-2"
          style={{ color: NAVY }}
        >
          support@watashi-torisetsu.com
        </a>
        으로 연락해 주세요.
      </p>

      <nav
        aria-label="결제 관련 안내"
        className="mt-4 flex max-w-[420px] flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] text-[#8A8AA3]"
      >
        <Link href="/ko/terms" className="underline underline-offset-2">
          이용약관
        </Link>
        <Link href="/ko/privacy" className="underline underline-offset-2">
          개인정보처리방침
        </Link>
        <Link
          href="/ko/legal/commerce"
          className="underline underline-offset-2"
        >
          판매 및 환불 안내
        </Link>
      </nav>

      <Link
        href="/ko"
        className="mt-6 text-center text-[12px] underline underline-offset-2 transition-colors hover:opacity-70"
        style={{ color: `${NAVY}80` }}
      >
        홈으로 돌아가기
      </Link>
      </main>
    </>
  );
}
