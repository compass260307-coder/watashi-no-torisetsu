import type { Metadata } from "next";
import KoreanLegalDocument from "@/components/ko/KoreanLegalDocument";

export const metadata: Metadata = {
  title: { absolute: "개인정보처리방침 | 나의 사용설명서" },
  description: "나의 사용설명서 한국어 서비스 개인정보처리방침입니다.",
  alternates: { canonical: "/ko/privacy" },
  robots: { index: false, follow: true },
};

export default function KoreanPrivacyPage() {
  return (
    <KoreanLegalDocument
      title="개인정보처리방침"
      lastUpdated="2026년 7월 18일"
    >
      <p>
        나의 사용설명서 운영팀(이하 “운영자”)은 “나의 사용설명서” 한국어
        서비스(이하 “서비스”)를 제공하면서 이용자의 개인정보를 다음과 같이
        처리합니다.
      </p>

      <h2>1. 개인정보처리자</h2>
      <ul>
        <li>개인정보처리자: 나의 사용설명서 운영팀</li>
        <li>
          개인정보 문의: <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a>
        </li>
      </ul>

      <h2>2. 처리하는 정보</h2>
      <h3>이용자가 입력하는 정보</h3>
      <ul>
        <li>자기 진단과 친구 평가의 답변</li>
        <li>닉네임 또는 표시 이름</li>
        <li>로그인 링크와 결과 복구를 위해 입력한 이메일 주소</li>
        <li>문의할 때 이용자가 제공한 내용</li>
      </ul>

      <h3>유료 서비스 이용 정보</h3>
      <ul>
        <li>구매 내역, 결제 금액, 통화, 결제 상태와 Stripe 거래 식별자</li>
      </ul>
      <p>
        카드 번호와 인증 정보는 결제대행사 Stripe가 직접 처리하며 운영자는 이를
        저장하지 않습니다.
      </p>

      <h3>자동으로 생성되는 정보</h3>
      <ul>
        <li>IP 주소, 접속 일시, 방문 페이지와 이전 페이지 정보</li>
        <li>브라우저, 운영체제, 기기와 화면 정보</li>
        <li>Cookie, Local Storage 및 서비스 이용 기록</li>
        <li>초대 코드와 진단 결과의 연결 관계</li>
      </ul>

      <h2>3. 처리 목적</h2>
      <ol>
        <li>성격 진단 결과의 계산, 저장과 표시</li>
        <li>친구 평가와 공유 기능 제공</li>
        <li>로그인 링크 발송과 결과 복구</li>
        <li>유료 콘텐츠 제공, 결제 확인, 환불과 구매 이력 관리</li>
        <li>문의 대응과 중요 안내 발송</li>
        <li>오류 분석, 보안, 부정 이용 방지와 서비스 품질 개선</li>
        <li>개인을 알아볼 수 없도록 처리한 통계 작성</li>
      </ol>

      <h2>4. 보유 기간과 파기</h2>
      <ol>
        <li>
          진단, 계정과 이용 정보는 서비스 제공에 필요한 동안 또는 이용자가 삭제를
          요청할 때까지 보유합니다.
        </li>
        <li>
          결제, 계약, 환불과 소비자 불만 관련 기록은 적용 법령에서 정한 기간 또는
          분쟁 처리를 위해 필요한 기간 동안 보유할 수 있습니다.
        </li>
        <li>
          보유 목적이 끝난 정보는 복구하기 어려운 방법으로 삭제합니다. 법령상
          보존이 필요한 정보는 다른 정보와 분리해 보관합니다.
        </li>
      </ol>

      <h2>5. 제3자 제공</h2>
      <p>
        운영자는 이용자의 동의 없이 개인정보를 제3자에게 판매하거나 제공하지
        않습니다. 다만, 법령에 따른 요청, 생명·신체·재산 보호를 위한 긴급 상황
        또는 서비스 제공에 필요한 업무 위탁은 예외로 합니다.
      </p>

      <h2>6. 처리 업무 위탁</h2>
      <p>
        운영자는 서비스 제공에 필요한 범위에서 아래 사업자의 시스템을 이용합니다.
      </p>
      <table>
        <thead>
          <tr>
            <th>수탁자</th>
            <th>업무</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Vercel Inc.</td>
            <td>웹사이트 호스팅과 전송</td>
          </tr>
          <tr>
            <td>Supabase Pte. Ltd.</td>
            <td>데이터베이스와 인증 데이터 관리</td>
          </tr>
          <tr>
            <td>Stripe, Inc.</td>
            <td>결제, 부정 결제 방지와 환불 처리</td>
          </tr>
          <tr>
            <td>Resend, Inc.</td>
            <td>로그인 링크와 서비스 이메일 발송</td>
          </tr>
          <tr>
            <td>Google LLC</td>
            <td>서비스 이용 통계 분석</td>
          </tr>
          <tr>
            <td>Cloudflare, Inc.</td>
            <td>도메인, 보안과 콘텐츠 전송</td>
          </tr>
        </tbody>
      </table>

      <h2>7. 국외 이전</h2>
      <p>
        서비스 이용 과정에서 정보가 암호화된 네트워크를 통해 일본, 미국 또는
        싱가포르 등에 있는 위탁 사업자의 서버로 전송·보관될 수 있습니다. 이전되는
        정보는 이메일, 진단·이용 기록, 접속 정보와 결제 처리에 필요한 정보이며,
        이전 목적은 제6조의 위탁 업무 수행입니다. 정보는 각 처리 목적 달성 또는
        계약 종료 시까지 보유되며, 법령상 보존이 필요한 경우에는 해당 기간 동안
        보유될 수 있습니다.
      </p>
      <p>
        국외 이전과 관련한 문의 또는 개인정보 처리 중지를 원하면 개인정보 문의
        이메일로 연락할 수 있습니다. 처리 중지를 요청하면 서비스의 일부 기능을
        이용하지 못할 수 있습니다.
      </p>

      <h2>8. Cookie와 분석 도구</h2>
      <ol>
        <li>
          서비스는 이용자 식별, 로그인 유지, 설정 저장과 이용 통계 분석을 위해
          Cookie 및 Local Storage를 사용합니다.
        </li>
        <li>
          이용자는 브라우저 설정에서 Cookie를 차단할 수 있지만, 그 경우 일부
          기능이 정상적으로 작동하지 않을 수 있습니다.
        </li>
        <li>
          Google Analytics 측정을 원하지 않으면 Google이 제공하는
          <a
            href="https://tools.google.com/dlpage/gaoptout"
            target="_blank"
            rel="noopener noreferrer"
          >
            옵트아웃 도구
          </a>
          를 사용할 수 있습니다.
        </li>
      </ol>

      <h2>9. 이용자의 권리</h2>
      <ol>
        <li>
          이용자는 자신의 개인정보에 대해 열람, 정정, 삭제, 처리 정지와 동의
          철회를 요청할 수 있습니다.
        </li>
        <li>
          요청은 support@watashi-torisetsu.com으로 접수하며, 본인 확인을 위해
          결제 또는 로그인에 사용한 이메일 주소 확인을 요청할 수 있습니다.
        </li>
        <li>
          법령상 보존 의무가 있거나 다른 사람의 권리를 침해할 우려가 있는 경우에는
          요청의 일부가 제한될 수 있으며 그 이유를 안내합니다.
        </li>
      </ol>

      <h2>10. 안전성 확보 조치</h2>
      <ul>
        <li>TLS를 이용한 전송 구간 암호화</li>
        <li>데이터베이스 접근 권한 제한</li>
        <li>결제 정보의 Stripe 직접 처리</li>
        <li>운영 환경의 접근 기록과 보안 업데이트 관리</li>
      </ul>

      <h2>11. 만 14세 미만 아동</h2>
      <p>
        운영자가 만 14세 미만 아동의 개인정보를 처리하기 위해 동의를 받아야 하는
        경우에는 법정대리인의 동의를 확인합니다. 그러한 동의 없이 아동의 정보가
        수집된 사실을 알게 되면 합리적인 기간 안에 삭제합니다.
      </p>

      <h2>12. 방침의 변경</h2>
      <p>
        이 방침이 변경되면 서비스 화면에 공개합니다. 이용자 권리에 중요한 영향을
        미치는 변경은 시행 전에 알기 쉬운 방법으로 안내합니다.
      </p>

      <h2>13. 문의</h2>
      <ul>
        <li>개인정보 보호 담당: 나의 사용설명서 운영팀</li>
        <li>
          이메일: <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a>
        </li>
      </ul>

      <hr />
      <p>시행일: 2026년 7월 18일</p>
    </KoreanLegalDocument>
  );
}
