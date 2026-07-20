import type { Metadata } from "next";
import KoreanLegalDocument from "@/components/ko/KoreanLegalDocument";

export const metadata: Metadata = {
  title: { absolute: "판매 및 환불 안내 | 나의 사용설명서" },
  description: "나의 사용설명서 한국어 유료 서비스의 거래 조건과 환불 안내입니다.",
  alternates: { canonical: "/ko/legal/commerce" },
  robots: { index: false, follow: true },
};

export default function KoreanCommercePage() {
  return (
    <KoreanLegalDocument
      title="판매 및 환불 안내"
      lastUpdated="2026년 7월 18일"
    >
      <p>
        나의 사용설명서 한국어 유료 서비스의 판매자 정보와 거래 조건을 다음과
        같이 안내합니다.
      </p>

      <h2>판매자</h2>
      <p>후타미 류노스케(나의 사용설명서 운영팀)</p>

      <h2>운영 책임자</h2>
      <p>후타미 류노스케</p>

      <h2>사업장 주소 및 전화번호</h2>
      <p>
        요청이 있으면 지체 없이 안내합니다. 아래 이메일로 연락해 주세요.
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
        <li>나의 사용설명서 성격 리포트 완전판</li>
        <li>₩4,900 · 1회 결제</li>
        <li>구독, 자동 갱신 또는 추가 결제 없음</li>
      </ul>
      <p>최종 결제 금액은 Stripe 결제 화면에서 다시 확인할 수 있습니다.</p>

      <h2>상품 내용</h2>
      <p>
        성격 유형의 연애·커리어 심층 분석, 주변에서 보는 인상과 상황별 주의점 등
        구매 화면에 표시된 상세 결과를 웹사이트에서 잠금 해제합니다. 한국어
        상품에는 PDF 다운로드가 포함되지 않습니다.
      </p>

      <h2>판매 가격 외 비용</h2>
      <p>
        서비스 이용에 필요한 인터넷 접속료와 데이터 통신료는 이용자가 부담합니다.
      </p>

      <h2>결제 방법</h2>
      <p>
        Stripe Checkout에 표시되는 신용·체크카드와 Samsung Pay, Kakao Pay,
        Naver Pay, PAYCO 등의 결제 수단을 이용할 수 있습니다. 실제로 사용할 수
        있는 수단은 기기와 Stripe의 제공 상황에 따라 달라질 수 있습니다.
      </p>

      <h2>결제 시기와 제공 시기</h2>
      <ol>
        <li>구매 화면에서 결제를 완료하면 결제가 확정됩니다.</li>
        <li>
          즉시 결제 수단은 결제 확인 후 바로 결과가 잠금 해제됩니다. 지연 결제
          수단은 Stripe에서 결제 성공이 확인된 뒤 잠금 해제됩니다.
        </li>
        <li>
          결제 완료 안내와 상세 결과 링크는 결제에 사용한 이메일 주소로 발송됩니다.
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
    </KoreanLegalDocument>
  );
}
