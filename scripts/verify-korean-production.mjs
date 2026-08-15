const BASE_URL = (
  process.env.KO_VERIFY_BASE_URL ?? "https://www.watashi-torisetsu.com"
).replace(/\/+$/, "");

const ROUTES = [
  "/ko",
  "/ko/diagnosis",
  "/ko/tako",
  "/ko/aisho",
  "/ko/types",
  "/ko/about",
  "/ko/articles",
  "/ko/articles/tako-bunseki",
  "/ko/login",
  "/ko/legal/commerce",
  "/ko/privacy",
  "/ko/terms",
  "/ko/purchase-complete",
  "/ko/result",
  "/ko/unmei",
  "/ko/hoshiyomi",
  "/ko/preview/sparkle-dolphin__N",
];

const unpaidMeToken = process.env.KO_VERIFY_UNPAID_ME_TOKEN?.trim();
if (unpaidMeToken) ROUTES.push(`/ko/me/${encodeURIComponent(unpaidMeToken)}`);

const checks = {
  "/ko": [
    [/href="\/ko\/diagnosis"/, "top page links to Korean diagnosis"],
    [/href="\/ko\/tako"/, "top page links to Korean friend diagnosis"],
    [/aria-label="로그인"|>로그인</, "top page exposes Korean login modal"],
    [/documentElement\.lang=.*\/ko.*ko/, "top page sets document language for Korean routes"],
    [/<div lang="ko"/, "top page wraps content with lang=ko"],
  ],
  "/ko/login": [
    [/로그인 링크 받기|이메일 주소/, "login page renders Korean login copy"],
  ],
  "/ko/articles/tako-bunseki": [
    [/타인 분석은 어떻게 할까/, "tako-bunseki article renders Korean title"],
    [/타인 분석 방법 3단계/, "tako-bunseki article renders full Korean body"],
  ],
  "/ko/preview/sparkle-dolphin__N": [
    [/href="\/ko\/diagnosis"/, "locked preview keeps Korean diagnosis links"],
  ],
};

if (unpaidMeToken) {
  checks[`/ko/me/${encodeURIComponent(unpaidMeToken)}`] = [
    [/지금 잠금 해제|모든 잠금 해제/, "unpaid result renders Korean unlock copy"],
    [/완전판|결제/, "unpaid result renders Korean payment copy"],
  ];
}

const forbidden = {
  "/ko": [
    [/href="\/diagnosis"/, "top page must not link to Japanese diagnosis"],
    [/href="\/tako"/, "top page must not link to Japanese friend diagnosis"],
  ],
  "/ko/preview/sparkle-dolphin__N": [
    [/친구 진단 초대 QR 코드|QRCodeSVG|qrcode\.react/, "self result preview must not include QR invite UI"],
    [/href="\/diagnosis"/, "locked preview must not link to Japanese diagnosis"],
    [/href="\/tako"/, "locked preview must not link to Japanese friend diagnosis"],
  ],
};

if (unpaidMeToken) {
  forbidden[`/ko/me/${encodeURIComponent(unpaidMeToken)}`] = [
    [/친구 진단 초대 QR 코드|QRCodeSVG|qrcode\.react/, "unpaid self result must not include QR invite UI"],
  ];
}

async function fetchText(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    headers: {
      "accept-language": "ko-KR,ko;q=0.9,ja;q=0.5,en;q=0.3",
    },
  });
  const text = await response.text();
  return { status: response.status, text };
}

const results = [];
const problems = [];

for (const route of ROUTES) {
  try {
    const { status, text } = await fetchText(route);
    results.push({ route, status, bytes: text.length });
    if (status < 200 || status >= 400) {
      problems.push(`${route}: expected 2xx/3xx, got ${status}`);
      continue;
    }
    for (const [pattern, label] of checks[route] ?? []) {
      if (!pattern.test(text)) problems.push(`${route}: missing ${label}`);
    }
    for (const [pattern, label] of forbidden[route] ?? []) {
      if (pattern.test(text)) problems.push(`${route}: forbidden ${label}`);
    }
  } catch (error) {
    problems.push(`${route}: request failed (${error instanceof Error ? error.message : String(error)})`);
  }
}

console.log(JSON.stringify({ baseUrl: BASE_URL, results, problems }, null, 2));
if (problems.length > 0) process.exitCode = 1;
