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
  "/ko/tarot",
  "/ko/tarot/one",
  "/ko/preview/sparkle-dolphin__N",
  "/robots.txt",
  "/sitemap.xml",
];

const unpaidMeToken = process.env.KO_VERIFY_UNPAID_ME_TOKEN?.trim();
if (unpaidMeToken) ROUTES.push(`/ko/me/${encodeURIComponent(unpaidMeToken)}`);

const checks = {
  "/ko": [
    [
      /<title>앨리스 진단 \| 나의 사용설명서<\/title>/,
      "brand-first title",
    ],
    [
      /<meta name="description" content="앨리스 진단은 Alice가 안내하는 성격 진단이에요\. 내 성격과 친구가 바라본 내 모습을 알아보고, 나만을 위한 ‘나의 사용설명서’를 만들어 보세요\."\/?>/,
      "Alice diagnosis description metadata",
    ],
    [
      /<link(?=[^>]*rel="canonical")(?=[^>]*href="https:\/\/www\.watashi-torisetsu\.com\/ko")[^>]*>/,
      "self-referencing canonical",
    ],
    [
      /<link(?=[^>]*rel="alternate")(?=[^>]*hrefLang="ko-KR")(?=[^>]*href="https:\/\/www\.watashi-torisetsu\.com\/ko")[^>]*>/,
      "ko-KR hreflang",
    ],
    [
      /<link(?=[^>]*rel="alternate")(?=[^>]*hrefLang="ja-JP")(?=[^>]*href="https:\/\/www\.watashi-torisetsu\.com")[^>]*>/,
      "ja-JP hreflang",
    ],
    [
      /<h1[^>]*>앨리스 진단<\/h1>/,
      "visible Alice diagnosis H1",
    ],
    [
      /앨리스 테스트\(Alice 진단·Alice 테스트\)/,
      "visible Korean and Latin Alice query variants",
    ],
    [
      /<meta(?=[^>]*property="og:title")(?=[^>]*content="앨리스 진단 \| 나의 사용설명서")[^>]*>/,
      "Alice diagnosis Open Graph title",
    ],
    [
      /<meta(?=[^>]*property="og:site_name")(?=[^>]*content="앨리스 진단")[^>]*>/,
      "Alice diagnosis Open Graph site name",
    ],
    [
      /"@type":"Brand"[^<]*"name":"앨리스 진단"/,
      "Alice diagnosis structured-data brand",
    ],
    [/href="\/ko\/diagnosis"/, "top page links to Korean diagnosis"],
    [/href="\/ko\/tako"/, "top page links to Korean friend diagnosis"],
    [/aria-label="로그인"|>로그인</, "top page exposes Korean login modal"],
    [/documentElement\.lang=.*\/ko.*ko/, "top page sets document language for Korean routes"],
    [/<div lang="ko"/, "top page wraps content with lang=ko"],
  ],
  "/robots.txt": [
    [/User-Agent: \*/i, "default crawler rule"],
    [/Allow: \//, "site crawl allowance"],
    [
      /Sitemap: https:\/\/www\.watashi-torisetsu\.com\/sitemap\.xml/,
      "sitemap declaration",
    ],
  ],
  "/sitemap.xml": [
    [
      /<loc>https:\/\/www\.watashi-torisetsu\.com\/ko<\/loc>/,
      "Korean home URL",
    ],
    [
      /<xhtml:link(?=[^>]*hreflang="ko-KR")(?=[^>]*href="https:\/\/www\.watashi-torisetsu\.com\/ko")[^>]*\/>/,
      "Korean home ko-KR alternate",
    ],
    [
      /<xhtml:link(?=[^>]*hreflang="ja-JP")(?=[^>]*href="https:\/\/www\.watashi-torisetsu\.com")[^>]*\/>/,
      "Korean home ja-JP alternate",
    ],
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
    [/<meta name="robots" content="[^"]*noindex/i, "top page must remain indexable"],
    [/href="\/diagnosis"/, "top page must not link to Japanese diagnosis"],
    [/href="\/tako"/, "top page must not link to Japanese friend diagnosis"],
  ],
  "/robots.txt": [
    [/^Disallow:\s*\/ko\s*$/im, "Korean home must not be blocked"],
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
    if (route === "/ko" && status !== 200) {
      problems.push(`/ko: expected a direct 200 response, got ${status}`);
      continue;
    }
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
