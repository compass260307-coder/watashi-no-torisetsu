import type { Metadata } from "next";
import KoreanLegalDocument from "@/components/ko/KoreanLegalDocument";
import {
  KO_DEFAULT_OG_IMAGE,
  KO_SITE_NAME,
  SITE_URL,
  localizedAlternates,
} from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: { absolute: "개인정보처리방침 | 나의 사용설명서" },
  description: "나의 사용설명서 한국어 서비스 개인정보처리방침입니다.",
  alternates: localizedAlternates("ko", "/privacy", "/ko/privacy"),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    alternateLocale: ["ja_JP"],
    url: `${SITE_URL}/ko/privacy`,
    siteName: KO_SITE_NAME,
    title: "개인정보처리방침 | 나의 사용설명서",
    description: "나의 사용설명서 한국어 서비스 개인정보처리방침입니다.",
    images: [KO_DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "개인정보처리방침 | 나의 사용설명서",
    description: "나의 사용설명서 한국어 서비스 개인정보처리방침입니다.",
    images: [KO_DEFAULT_OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export default function KoreanPrivacyPage() {
  return (
    <KoreanLegalDocument
      title="개인정보처리방침"
      lastUpdated="2026년 8월 16일"
    >
      <p>
        나의 사용설명서 운영팀(이하 “운영자”)은 “나의 사용설명서” 한국어
        서비스(이하 “서비스”)를 제공하면서 이용자의 개인정보를 다음과 같이
        처리합니다.
      </p>

      <h2>1. 개인정보처리자</h2>
      <ul>
        <li>개인정보처리자: 후타미 류노스케(나의 사용설명서 운영팀)</li>
        <li>소재 국가: 일본</li>
        <li>개인정보 보호 업무 담당: 나의 사용설명서 운영팀</li>
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
        <li>
          운명의 설계도 이용 시 입력하는 생년월일, 출생 시간과 출생 지역
        </li>
        <li>별자리 상담사에게 입력한 상담 내용과 저장된 대화 기록</li>
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
        <li>쿠키(Cookie), Local Storage 및 서비스 이용 기록</li>
        <li>유입 경로와 캠페인 식별자</li>
        <li>
          광고 전환 측정이 설정된 경우 광고 클릭 식별자(ttclid 등), 캠페인
          정보와 SHA-256 방식으로 단방향 변환된 이메일 값
        </li>
        <li>초대 코드와 진단 결과의 연결 관계</li>
      </ul>

      <h2>3. 처리 목적</h2>
      <ol>
        <li>성격 진단 결과의 계산, 저장과 표시</li>
        <li>
          출생 순간의 천체 배치 계산과 한국어 운명의 설계도 생성 및 표시
        </li>
        <li>성격 진단과 운명의 설계도를 참고한 별자리 상담 대화 제공</li>
        <li>친구 평가와 공유 기능 제공</li>
        <li>로그인 링크 발송과 결과 복구</li>
        <li>유료 콘텐츠 제공, 결제 확인, 환불과 구매 이력 관리</li>
        <li>문의 대응과 중요 안내 발송</li>
        <li>오류 분석, 보안, 부정 이용 방지와 서비스 품질 개선</li>
        <li>유입 경로와 캠페인별 서비스 이용 현황 분석</li>
        <li>개인을 알아볼 수 없도록 처리한 통계 작성</li>
      </ol>

      <h2>4. 보유 기간과 파기</h2>
      <ol>
        <li>
          진단 답변·결과, 친구 평가, 출생 정보, 별자리 상담 기록, 계정과 결과
          연결 정보는 서비스 이용 종료, 계정 삭제 또는 이용자의 삭제 요청
          시까지 보유합니다.
        </li>
        <li>
          전자상거래 등에서의 소비자보호에 관한 법률에 따라 표시·광고 기록은 6개월,
          계약 또는 청약철회 기록은 5년, 대금 결제 및 콘텐츠 공급 기록은 5년,
          소비자 불만 또는 분쟁 처리 기록은 3년간 보관합니다.
        </li>
        <li>
          브라우저에 저장되는 쿠키와 Local Storage 정보는 이용자가 브라우저
          설정에서 삭제하거나 각 저장 항목의 유효기간이 끝날 때까지 보관됩니다.
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
            <td>웹사이트 호스팅·전송 및 AI 요청 중계</td>
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
            <td>Anthropic PBC</td>
            <td>
              성격 진단 결과값과 계산된 천체 배치를 바탕으로 운명의 설계도 문장 및
              별자리 상담 답변 생성
            </td>
          </tr>
          <tr>
            <td>Google LLC</td>
            <td>태그 관리와 서비스 이용 통계 분석</td>
          </tr>
          <tr>
            <td>Cloudflare, Inc.</td>
            <td>도메인, 보안과 콘텐츠 전송</td>
          </tr>
          <tr>
            <td>Meta Platforms, Inc. / TikTok Pte. Ltd.</td>
            <td>해당 광고 측정 태그가 활성화된 경우 캠페인 전환 측정</td>
          </tr>
        </tbody>
      </table>

      <h2>7. 국외 이전</h2>
      <p>
        이용자가 요청한 서비스 제공과 계약 이행에 필요한 정보는 개인정보 보호법
        제28조의8에 따라 아래 사업자에게 국외 이전될 수 있습니다. 정보는 서비스
        이용 또는 각 기능 실행 시 암호화된 네트워크를 통해 전송됩니다.
      </p>
      <table>
        <thead>
          <tr>
            <th>이전받는 자·국가·연락처</th>
            <th>이전 항목과 목적</th>
            <th>보유 기간</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Vercel Inc. · 미국 · <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">개인정보 문의</a></td>
            <td>접속·기기 정보, 서비스 요청 정보, AI 요청 중계 정보 · 호스팅, 전송 및 AI Gateway 중계</td>
            <td>서비스 제공 또는 위탁계약 종료 시까지</td>
          </tr>
          <tr>
            <td>Supabase Pte. Ltd. · 싱가포르 · <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">개인정보 문의</a></td>
            <td>이메일, 닉네임, 진단·친구 평가·출생·상담·구매 기록 · 데이터베이스와 인증 운영</td>
            <td>제4조의 보유 기간 또는 위탁계약 종료 시까지</td>
          </tr>
          <tr>
            <td>Stripe, Inc. · 미국 · <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">개인정보 문의</a></td>
            <td>이메일, 결제 수단 정보, 금액, 통화, 거래 식별자와 상태 · 결제, 부정 이용 방지 및 환불</td>
            <td>결제 처리 목적 달성 및 관련 법령상 보존기간까지</td>
          </tr>
          <tr>
            <td>Resend, Inc. · 미국 · <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">개인정보 문의</a></td>
            <td>이메일, 표시 이름, 결과·구매 링크와 발송 내용 · 로그인 및 서비스 이메일 발송</td>
            <td>발송 목적 달성 또는 위탁계약 종료 시까지</td>
          </tr>
          <tr>
            <td>Anthropic PBC · 미국 · <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">개인정보 문의</a></td>
            <td>닉네임, 진단 결과, 출생 정보와 계산된 천체 배치, 이용자가 입력한 상담 내용 · 운명의 설계도 및 별자리 상담 답변 생성</td>
            <td>응답 생성 목적 달성 또는 위탁계약 종료 시까지</td>
          </tr>
          <tr>
            <td>Google LLC · 미국 · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">개인정보 문의</a></td>
            <td>온라인 식별자, 접속·기기 정보, 방문 페이지, 유입 경로와 이용 이벤트 · 태그 관리 및 이용 통계</td>
            <td>Google의 설정 및 정책에 따른 기간</td>
          </tr>
          <tr>
            <td>Cloudflare, Inc. · 미국 · <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">개인정보 문의</a></td>
            <td>IP 주소와 네트워크 요청 정보 · 보안, 도메인 및 콘텐츠 전송</td>
            <td>보안·전송 목적 달성 또는 위탁계약 종료 시까지</td>
          </tr>
          <tr>
            <td>Meta Platforms, Inc. · 미국 / TikTok Pte. Ltd. · 싱가포르 · <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">Meta</a>·<a href="https://www.tiktok.com/legal/page/row/privacy-policy/en" target="_blank" rel="noopener noreferrer">TikTok</a></td>
            <td>해당 태그가 활성화된 경우 온라인 식별자, 광고 클릭·캠페인 정보, 이용 이벤트와 단방향 변환된 이메일 값 · 광고 전환 측정</td>
            <td>각 광고 플랫폼의 설정 및 정책에 따른 기간</td>
          </tr>
        </tbody>
      </table>
      <p>
        이용자는 브라우저의 쿠키 차단 또는 개인정보 문의 이메일을 통해 선택적인
        분석·광고 측정을 거부하거나 국외 이전의 처리정지를 요청할 수 있습니다.
        호스팅, 데이터베이스, 결제, 이메일 및 AI 생성처럼 요청한 기능 제공에
        필수적인 이전을 거부하면 해당 기능을 이용하지 못할 수 있습니다.
      </p>

      <h2>8. 쿠키(Cookie)와 분석·광고 측정 도구</h2>
      <ol>
        <li>
          서비스는 이용자 식별, 로그인 유지, 설정 저장과 이용 통계 분석을 위해
          쿠키 및 Local Storage를 사용합니다.
        </li>
        <li>
          Google Tag Manager와 Google Analytics를 통해 온라인 식별자,
          브라우저·기기 정보, 방문 페이지, 이전 페이지와 서비스 이용 이벤트가
          수집될 수 있습니다.
        </li>
        <li>
          Google Tag Manager에 광고 측정 태그가 설정된 경우 Meta 또는 TikTok에
          광고 클릭·캠페인 정보, 이용 이벤트와 단방향 변환된 이메일 값이 전달될
          수 있습니다. 이메일 원문은 광고 측정 이벤트에 포함하지 않습니다.
        </li>
        <li>
          이용자는 브라우저 설정에서 쿠키를 차단할 수 있지만, 그 경우 일부
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
          이용자는 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지와 동의
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
        서비스는 현재 만 14세 미만 아동을 대상으로 하지 않으며 법정대리인 동의를
        확인하는 별도 절차를 제공하지 않습니다. 만 14세 미만 이용자는 개인정보를
        입력하지 말아 주세요. 운영자가 법정대리인의 확인 없이 아동의 정보가
        수집된 사실을 알게 되면 지체 없이 삭제합니다.
      </p>

      <h2>12. 자동화된 처리</h2>
      <p>
        서비스는 이용자의 답변과 출생 정보를 이용해 성격 진단, 궁합 및 운세
        콘텐츠를 자동 생성합니다. 이는 오락과 자기 이해를 위한 결과이며, 이용자의
        법적 권리·의무에 중대한 영향을 미치는 자동화된 결정을 하지 않습니다.
      </p>

      <h2>13. 방침의 변경</h2>
      <p>
        이 방침이 변경되면 원칙적으로 시행 7일 전부터 서비스 화면에 공개합니다.
        이용자 권리에 중대한 불리한 변경은 시행 30일 전에 알기 쉬운 방법으로
        안내합니다.
      </p>

      <h2>14. 문의 및 권익 침해 구제</h2>
      <ul>
        <li>개인정보 보호 담당: 나의 사용설명서 운영팀</li>
        <li>
          이메일: <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a>
        </li>
      </ul>
      <p>
        개인정보 침해에 관한 상담은 개인정보침해 신고센터(국번 없이 118, {" "}
        <a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener noreferrer">privacy.kisa.or.kr</a>) 또는 개인정보분쟁조정위원회({" "}
        <a href="https://www.kopico.go.kr" target="_blank" rel="noopener noreferrer">kopico.go.kr</a>)에도 요청할 수 있습니다.
      </p>

      <hr />
      <p>시행일: 2026년 7월 18일</p>
      <p>최종 개정일: 2026년 8월 16일</p>
    </KoreanLegalDocument>
  );
}
