import Link from "next/link";

export function KoreanPurchaseLegalNotice({
  className = "",
}: {
  className?: string;
}) {
  return (
    <p
      className={`text-[11px] leading-[1.75] text-[#77798B] ${className}`.trim()}
    >
      구매 버튼을 누르면 <Link href="/ko/terms" className="font-bold underline underline-offset-2">이용약관</Link>,{" "}
      <Link href="/ko/privacy" className="font-bold underline underline-offset-2">개인정보처리방침</Link>,{" "}
      <Link href="/ko/legal/commerce" className="font-bold underline underline-offset-2">판매·환불 조건</Link>을 확인하고 동의한다는 의사를 표시하게 됩니다. 상품은 결제 확인 후 즉시 제공되는 디지털 콘텐츠이며, 결제일로부터 30일 이내에 전액 환불을 요청할 수 있습니다. 미성년자는 법정대리인의 동의를 받아야 하며, 동의 없이 체결한 계약은 본인 또는 법정대리인이 취소할 수 있습니다.
    </p>
  );
}
