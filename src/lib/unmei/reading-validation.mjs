export const READING_TITLES = {
  ja: {
    haichi: "あなたが積み上げてきたもの",
    kokoro: "誰かといるときのあなた",
    chosen: "これから訪れる転換点",
    grace: "最後にひとつだけ",
  },
  ko: {
    haichi: "당신이 차곡차곡 쌓아 온 것",
    kokoro: "누군가와 함께 있을 때의 당신",
    chosen: "앞으로 찾아올 전환점",
    grace: "마지막으로 한 가지만",
  },
};

const SECTION_IDS = ["haichi", "kokoro", "chosen", "grace"];

// 韓国語本文では漢字・かなを使わない。英数字、記号、占星術の度数表記は許可する。
const JAPANESE_OR_HAN_SCRIPT = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;

function visibleText(reading) {
  const parts = [reading?.hitokoto ?? ""];
  for (const section of reading?.sections ?? []) {
    parts.push(section?.title ?? "", section?.subline ?? "", section?.body ?? "");
  }
  return parts.filter((part) => typeof part === "string").join("\n");
}

export function validateReadingLocale(reading, locale = "ja") {
  const normalizedLocale = locale === "ko" ? "ko" : "ja";
  const errors = [];

  if (!reading || typeof reading !== "object") return ["reading must be an object"];
  if (typeof reading.hitokoto !== "string" || !reading.hitokoto.trim()) {
    errors.push("hitokoto must be a non-empty string");
  }
  if (!Array.isArray(reading.sections) || reading.sections.length !== SECTION_IDS.length) {
    errors.push("sections must contain exactly four items");
    return errors;
  }

  const titles = READING_TITLES[normalizedLocale];
  reading.sections.forEach((section, index) => {
    const expectedId = SECTION_IDS[index];
    if (!section || typeof section !== "object") {
      errors.push(`section ${index} must be an object`);
      return;
    }
    if (section.id !== expectedId) errors.push(`section ${index} id must be ${expectedId}`);
    if (section.title !== titles[expectedId]) {
      errors.push(`section ${expectedId} title does not match ${normalizedLocale}`);
    }
    if (typeof section.subline !== "string") {
      errors.push(`section ${expectedId} subline must be a string`);
    }
    if (typeof section.body !== "string" || !section.body.trim()) {
      errors.push(`section ${expectedId} body must be a non-empty string`);
    }
    if (expectedId === "grace" && section.subline !== "") {
      errors.push("section grace subline must be empty");
    }
  });

  if (normalizedLocale === "ko" && JAPANESE_OR_HAN_SCRIPT.test(visibleText(reading))) {
    errors.push("Korean reading contains Japanese or Han script");
  }

  return errors;
}

export function isReadingLocaleValid(reading, locale = "ja") {
  return validateReadingLocale(reading, locale).length === 0;
}
