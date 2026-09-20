const BASE_URL = (
  process.env.EN_VERIFY_BASE_URL ?? "https://www.watashi-torisetsu.com"
).replace(/\/+$/, "");

const checks = {
  "/": [
    [
      /"@type":"WebSite"[^<]*"name":"Alice Personalities"/,
      "domain-level Alice Personalities WebSite name",
    ],
    [
      /"@type":"Brand"[^<]*"name":"Alice Personalities"/,
      "domain-level Alice Personalities brand",
    ],
    [/>Alice Personalities<\/a>/, "visible Alice Personalities home identity"],
  ],
  "/en": [
    [
      /<title>Alice Personalities \| Free Big Five Personality Test<\/title>/,
      "brand-first English title",
    ],
    [
      /<link(?=[^>]*rel="canonical")(?=[^>]*href="https:\/\/www\.watashi-torisetsu\.com\/en")[^>]*>/,
      "self-referencing canonical",
    ],
    [
      /<link(?=[^>]*rel="alternate")(?=[^>]*hrefLang="en-US")(?=[^>]*href="https:\/\/www\.watashi-torisetsu\.com\/en")[^>]*>/,
      "en-US hreflang",
    ],
    [
      /<h1[^>]*>Alice Personalities: See yourself through your friends’ eyes\.<\/h1>/,
      "Alice Personalities hero H1",
    ],
    [
      /<meta(?=[^>]*property="og:site_name")(?=[^>]*content="Alice Personalities")[^>]*>/,
      "Alice Personalities Open Graph site name",
    ],
    [
      /"@type":"Brand"[^<]*"name":"Alice Personalities"/,
      "Alice Personalities brand entity",
    ],
    [
      /"isPartOf":\{"@id":"https:\/\/www\.watashi-torisetsu\.com\/#website"\}/,
      "domain-level WebSite relationship",
    ],
  ],
  "/en/diagnosis": [
    [
      /<title>Free Big Five Personality Test \| Alice Personalities<\/title>/,
      "branded Big Five title",
    ],
    [
      /<h1[^>]*>Free Big Five Personality Test<\/h1>/,
      "Big Five diagnosis H1",
    ],
  ],
  "/en/types": [
    [
      /<title>32 Personality Types \| Alice Personalities<\/title>/,
      "branded personality types title",
    ],
    [
      /<meta(?=[^>]*property="og:title")(?=[^>]*content="32 Personality Types \| Alice Personalities")[^>]*>/,
      "personality types Open Graph title",
    ],
    [/<h1[^>]*>Personality Types<\/h1>/, "personality types H1"],
  ],
  "/en/about": [
    [
      /<title>About Alice Personalities \| Big Five Personality Test<\/title>/,
      "brand-specific about title",
    ],
    [
      /<meta(?=[^>]*property="og:url")(?=[^>]*content="https:\/\/www\.watashi-torisetsu\.com\/en\/about")[^>]*>/,
      "about Open Graph URL",
    ],
  ],
  "/en/aisho": [
    [
      /<title>Personality Compatibility Test \| Alice Personalities<\/title>/,
      "branded compatibility title",
    ],
    [
      /<h1[^>]*>Personality Compatibility Test<\/h1>/,
      "server-rendered compatibility H1",
    ],
    [/href="\/en\/types"/, "server-rendered personality types link"],
    [/href="\/en\/diagnosis"/, "server-rendered diagnosis link"],
  ],
  "/en/articles": [
    [
      /<title>Personality Test Guides \| Alice Personalities<\/title>/,
      "branded guides title",
    ],
    [
      /<meta(?=[^>]*property="og:title")(?=[^>]*content="Personality Test Guides \| Alice Personalities")[^>]*>/,
      "guides Open Graph title",
    ],
  ],
  "/robots.txt": [
    [/User-Agent: \*/i, "default crawler rule"],
    [
      /Sitemap: https:\/\/www\.watashi-torisetsu\.com\/sitemap\.xml/,
      "sitemap declaration",
    ],
  ],
  "/sitemap.xml": [
    [
      /<loc>https:\/\/www\.watashi-torisetsu\.com\/en<\/loc>/,
      "English home URL",
    ],
    [
      /<loc>https:\/\/www\.watashi-torisetsu\.com\/en\/diagnosis<\/loc>/,
      "English diagnosis URL",
    ],
    [
      /<xhtml:link(?=[^>]*hreflang="en-US")(?=[^>]*href="https:\/\/www\.watashi-torisetsu\.com\/en")[^>]*\/>/,
      "English home en-US alternate",
    ],
  ],
};

const forbidden = {
  "/en": [
    [
      /<meta name="robots" content="[^"]*noindex/i,
      "English home must remain indexable",
    ],
    [
      /"@type":"WebSite"[^<]*"url":"https:\/\/www\.watashi-torisetsu\.com\/en"/,
      "subdirectory-level WebSite entity",
    ],
  ],
  "/robots.txt": [
    [/^Disallow:\s*\/en\s*$/im, "English home must not be blocked"],
  ],
};

const results = [];
const problems = [];

for (const route of Object.keys(checks)) {
  try {
    const response = await fetch(`${BASE_URL}${route}`, {
      redirect: "manual",
      headers: {
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
      },
    });
    const text = await response.text();
    results.push({ route, status: response.status, bytes: text.length });
    if (response.status < 200 || response.status >= 400) {
      problems.push(`${route}: expected 2xx/3xx, got ${response.status}`);
      continue;
    }
    for (const [pattern, label] of checks[route]) {
      if (!pattern.test(text)) problems.push(`${route}: missing ${label}`);
    }
    for (const [pattern, label] of forbidden[route] ?? []) {
      if (pattern.test(text)) problems.push(`${route}: forbidden ${label}`);
    }
  } catch (error) {
    problems.push(
      `${route}: request failed (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

console.log(JSON.stringify({ baseUrl: BASE_URL, results, problems }, null, 2));
if (problems.length > 0) process.exitCode = 1;
