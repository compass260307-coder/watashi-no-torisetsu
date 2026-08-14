import type { Metadata } from "next";
import KoreanLegalDocument from "@/components/ko/KoreanLegalDocument";
import {
  KO_DEFAULT_OG_IMAGE,
  KO_SITE_NAME,
  SITE_URL,
  localizedAlternates,
} from "@/lib/locale-seo";
import {
  FULL_ACCESS_PRICE_KRW,
  PREMIUM_BUNDLE_PRICE_KRW,
  SELF_REPORT_PRICE_KRW,
} from "@/lib/access-products";
import { KO_UNMEI_ENABLED } from "@/lib/feature-flags";

const krw = (amount: number) => `₩${amount.toLocaleString("ko-KR")}`;

export const metadata: Metadata = {
  title: { absolute: "판매 및 환불 안내 | 나의 사용설명서" },
  description: "나의 사용설명서 한국어 유료 서비스의 거래 조건과 환불 안내입니다.",
  alternates: localizedAlternates(
    "ko",
    "/legal/commerce",
    "/ko/legal/commerce",
  ),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    alternateLocale: ["ja_JP"],
    url: `${SITE_URL}/ko/legal/commerce`,
    siteName: KO_SITE_NAME,
    title: "판매 및 환불 안내 | 나의 사용설명서",
    description: "나의 사용설명서 한국어 유료 서비스의 거래 조건과 환불 안내입니다.",
    images: [KO_DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "판매 및 환불 안내 | 나의 사용설명서",
    description: "나의 사용설명서 한국어 유료 서비스의 거래 조건과 환불 안내입니다.",
    images: [KO_DEFAULT_OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export default function KoreanCommercePage() {
  return (
    <KoreanLegalDocument
      title="판매 및 환불 안내"
      lastUpdated="2026년 8월 12일"
    >
      <p>
        나의 사용설명서 한국어 유료 서비스의 판매자 정보와 거래 조건을 다음과
        같이 안내합니다.
      </p>

      <h2>판매자</h2>
      <p>후타미 류노스케(나의 사용설명서 운영팀)</p>

      <h2>운영 책임자</h2>
      <p>후타미 류노스케</p>

      <h2>사업장 소재 국가</h2>
      <p>일본</p>

      <h2>사업장 주소 및 전화번호</h2>
      <p>
        구체적인 주소와 전화번호는 요청이 있으면 지체 없이 안내합니다. 구매 전
        확인이 필요한 경우 아래 이메일로 연락해 주세요.
      </p>

      <h2>문의</h2>
      <ul>
        <li>
          이메일: <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a>
        </li>
        <li>통상 3영업일 이내에 답변합니다.</li>
      </ul>

      <h2>상품명과 판매 가격</h2>
      <ul>
        <li>
          라이트 코스: {krw(SELF_REPORT_PRICE_KRW)} · 1회 결제 (자기 진단과
          친구 진단 결과 및 분석 PDF 포함)
        </li>
        <li>
          완전판 코스: {krw(FULL_ACCESS_PRICE_KRW)} · 1회 결제 (라이트
          구매자는 차액 {krw(FULL_ACCESS_PRICE_KRW - SELF_REPORT_PRICE_KRW)})
        </li>
        {KO_UNMEI_ENABLED ? (
          <li>
            프리미엄 코스: {krw(PREMIUM_BUNDLE_PRICE_KRW)} · 1회 결제
            (라이트 구매자는 차액{" "}
            {krw(PREMIUM_BUNDLE_PRICE_KRW - SELF_REPORT_PRICE_KRW)}, 완전판
            구매자는 차액{" "}
            {krw(PREMIUM_BUNDLE_PRICE_KRW - FULL_ACCESS_PRICE_KRW)})
          </li>
        ) : null}
        <li>구독, 자동 갱신 또는 추가 결제 없음</li>
      </ul>
      {!KO_UNMEI_ENABLED ? (
        <p>
          프리미엄 코스와 “운명의 설계도”는 현재 한국어판에서 판매 및 신규 이용을
          일시 중지하고 있습니다.
        </p>
      ) : null}
      <p>
        표시 가격은 세금이 포함된 최종 가격입니다. 최종 결제 금액은 Stripe 결제
        화면에서 다시 확인할 수 있습니다.
      </p>

      <h2>상품 내용</h2>
      <ul>
        <li>
          라이트: 자기 진단 결과의 잠긴 8개 섹션 전체 해제, 16페이지 이상의
          자기 분석 PDF, 두 번째 친구부터의 친구 진단 결과 전체 해제, 여러 번
          다시 만들 수 있는 친구 분석 PDF
        </li>
        <li>
          완전판: 라이트의 모든 기능, 연애 파트너 궁합 분석
        </li>
        {KO_UNMEI_ENABLED ? (
          <li>
            프리미엄: 완전판의 모든 기능, 출생 정보와 성격 진단을 함께 읽는 한국어
            운명의 설계도
          </li>
        ) : null}
      </ul>
      <p>
        웹 결과와 PDF는 구매 후에도 같은 결과 링크에서 반복해서 이용할 수 있습니다.
        친구 진단 PDF는 답변한 친구가 한 명 이상 있을 때 생성됩니다.
      </p>

      <h2>판매 가격 외 비용</h2>
      <p>
        서비스 이용에 필요한 인터넷 접속료와 데이터 통신료는 이용자가 부담합니다.
      </p>

      <h2>결제 방법</h2>
      <p>
        Stripe Checkout에서 구매 시점에 실제로 표시되는 신용·체크카드 및
        간편결제 수단을 이용할 수 있습니다. 이용 가능한 수단은 기기, 브라우저와
        Stripe의 제공 상황에 따라 달라질 수 있습니다.
      </p>

      <h2>결제 시기와 제공 시기</h2>
      <ol>
        <li>구매 화면에서 결제를 완료하면 결제가 확정됩니다.</li>
        <li>
          즉시 결제 수단은 결제 확인 후 바로 결과가 잠금 해제됩니다. 지연 결제
          수단은 Stripe에서 결제 성공이 확인된 뒤 잠금 해제됩니다.
        </li>
        <li>
          결제 완료 안내, 상세 결과 링크와 자기 분석 PDF 다운로드 링크는 결제에
          사용한 이메일 주소로 발송됩니다. 친구 진단 PDF는 친구 진단 결과
          페이지에서 다운로드할 수 있습니다.
        </li>
      </ol>

      <h2>청약철회, 취소 및 30일 환불 보장</h2>
      <ol>
        <li>
          구매자는 결제일로부터 30일 이내에 구매 금액 전액의 환불을 요청할 수
          있습니다.
        </li>
        <li>
          support@watashi-torisetsu.com으로 결제에 사용한 이메일 주소와 환불 요청
          사실을 보내 주세요.
        </li>
        <li>환불 보장은 동일한 결제 건당 1회 적용됩니다.</li>
        <li>
          환불은 원칙적으로 Stripe를 통해 원래 결제 수단으로 처리됩니다. 결제
          회사의 처리 일정에 따라 실제 반영까지 며칠이 걸릴 수 있습니다.
        </li>
        <li>
          전액 환불이 완료되면 해당 결제로 부여된 유료 기능의 이용 권한도
          종료됩니다. 다른 유효한 구매가 남아 있으면 그 구매 범위는 계속 이용할
          수 있습니다.
        </li>
        <li>
          부정 결제, 제3자의 결제 수단 도용 또는 환불 제도의 명백한 악용이 의심되는
          경우에는 본인 확인과 사실 확인을 요청할 수 있습니다.
        </li>
        <li>
          서비스가 정상적으로 제공되지 않은 경우에도 위 이메일로 연락해 주세요.
          확인 후 재제공 또는 환불 등 적절한 조치를 합니다.
        </li>
        <li>
          이 환불 보장은 관련 법령에 따른 청약철회, 계약 해제, 하자에 대한 권리나
          손해배상 청구를 제한하지 않습니다.
        </li>
      </ol>

      <h2>이용 환경</h2>
      <p>
        최신 버전의 Safari, Chrome 등 주요 모바일 또는 PC 브라우저 이용을
        권장합니다.
      </p>

      <h2>분쟁 및 피해 구제</h2>
      <p>
        거래 또는 환불과 관련한 불만은 먼저 문의 이메일로 접수해 주세요. 관련
        법령에 따른 소비자 분쟁 해결 절차를 이용할 권리는 제한되지 않습니다.
      </p>

      <hr />
      <p>시행일: 2026년 7월 18일</p>
      <p>최종 개정일: 2026년 8월 12일</p>
    </KoreanLegalDocument>
  );
}
