import { LoginCard } from "@/components/LoginCard";
import type { ResultLocale } from "@/i18n/result";

const COPY = {
  ja: {
    title: "購入ありがとうございます！",
    bodyBefore: "あなたの鑑定は、購入に使ったメールアドレスに紐づいています。",
    bodyAfter: "同じメールアドレスでログインすると、出生情報の入力に進み、",
    product: "運命の設計図",
    productSuffix: "が作成されます。",
    refundBefore:
      "30日間の返金保証つき。返金をご希望の場合は、購入に使ったメールアドレスを添えて",
    refundAfter: "までご連絡ください。",
  },
  ko: {
    title: "구매해 주셔서 감사합니다!",
    bodyBefore: "감정서는 구매에 사용한 이메일 주소에 연결되어 있어요.",
    bodyAfter:
      "같은 이메일 주소로 로그인하면 출생 정보 입력으로 이어지고,",
    product: "운명의 설계도",
    productSuffix: "가 만들어집니다.",
    refundBefore:
      "30일 환불 보장이 포함되어 있어요. 환불을 원하시면 결제에 사용한 이메일 주소와 함께",
    refundAfter: "으로 연락해 주세요.",
  },
} as const;

export default function UnmeiGuestPurchaseComplete({
  locale = "ja",
}: {
  locale?: ResultLocale;
}) {
  const copy = COPY[locale];

  return (
    <main className="mx-auto flex max-w-[640px] flex-col items-center px-6 py-14 text-center">
      <div
        aria-hidden="true"
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#3FA96A] text-white"
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
      <h1 className="text-2xl font-black text-[#2E2E5C]">{copy.title}</h1>
      <p className="mb-8 mt-3 text-[13px] font-bold leading-[1.8] text-[#8A8AA3]">
        {copy.bodyBefore}
        <br />
        {copy.bodyAfter}
        <br className="hidden md:inline" />
        <span className="text-[#2E2E5C]">{copy.product}</span>
        {copy.productSuffix}
      </p>
      <LoginCard locale={locale} />
      <p className="mt-6 max-w-[420px] text-[12px] font-bold leading-[1.7] text-[#8A8AA3]">
        {copy.refundBefore}{" "}
        <a
          href="mailto:support@watashi-torisetsu.com"
          className="text-[#2E2E5C] underline underline-offset-2"
        >
          support@watashi-torisetsu.com
        </a>{" "}
        {copy.refundAfter}
      </p>
    </main>
  );
}
