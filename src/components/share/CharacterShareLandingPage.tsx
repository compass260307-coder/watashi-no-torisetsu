// キャラシェア着地ページ /share/{invite_code}・/ko/share/{invite_code}。
//   - per-owner OG: そのオーナーの称号キャラOGカードを og:image に出す。
//   - 2026-07-26 刷新: 薄い1枚カードをやめ、シェア主タイプの結果ページ (モック) を
//     課金導線なしでまるごと見せる (MeResultPage 獲得モード)。CTA は
//     「無料で性格診断をする」(/diagnosis) に統一。
//   - ⚠ /friend(評価依頼) や /me(private) には誘導しない。純粋な拡散導線。
//   - invite_code は既に公開値 (/friend でも使用)。ここでは display_name + type を逆引きし、
//     32タイプの称号・キャラ画像・OGカードに解決する (本文はタイプ別モックで、
//     シェア主の実回答・友達回答は表示しない)。

import type { Metadata } from "next";
import Link from "next/link";
import MeResultPage from "@/components/result/MeResultPage";
import { KO_RESULT_TYPES } from "@/i18n/ko/result";
import type { ResultLocale } from "@/i18n/result";
import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  baseIdOf,
  classifyThirtyTwoType,
  thirtyTwoEssence,
  thirtyTwoImagePath,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { sixteenTypes } from "@/lib/sixteen-types";
import type { BigFiveDimension } from "@/lib/types";
import { localizedAlternates } from "@/lib/locale-seo";

const SITE_URL = resolveSiteUrl();
const NAVY = "#2A3A5C";

interface ShareData {
  name: string;
  essence: string;
  slug: string;
  t32: ThirtyTwoTypeId;
}

// invite_code → display_name + scores → 32タイプの称号/slug に解決。無ければ null。
async function loadShareData(
  code: string,
  locale: ResultLocale,
): Promise<ShareData | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("display_name, scores")
    .eq("invite_code", code)
    .maybeSingle();
  if (!data) return null;
  const scores = (data.scores ?? {}) as Partial<
    Record<BigFiveDimension, number>
  >;
  const t32 = classifyThirtyTwoType(scores);
  const essence =
    locale === "ko" ? KO_RESULT_TYPES[t32].essence : thirtyTwoEssence(t32);
  // thirtyTwoImagePath = /characters/v3/{slug}.webp → slug を取り出し og-characters/{slug}.jpg に。
  const slug = thirtyTwoImagePath(t32)
    .split("/")
    .pop()!
    .replace(/\.\w+$/, "");
  const name =
    ((data.display_name as string | null) ?? "").trim() ||
    (locale === "ko" ? "어떤 사람" : "ある人");
  return { name, essence, slug, t32 };
}

export async function generateCharacterShareMetadata({
  params,
  locale,
}: {
  params: Promise<{ code: string }>;
  locale: ResultLocale;
}): Promise<Metadata> {
  const { code } = await params;
  const d = await loadShareData(code, locale);
  const isKorean = locale === "ko";
  const codePath = encodeURIComponent(code);
  const alternates = localizedAlternates(
    locale,
    `/share/${codePath}`,
    `/ko/share/${codePath}`,
  );
  const siteName = isKorean ? "나의 사용설명서" : "ワタシのトリセツ";
  const description = isKorean
    ? "나는 어떤 유형일까요? 무료로 약 3분 만에 진단할 수 있어요."
    : "あなたは何タイプ？無料・約3分で診断できるよ";
  if (!d) {
    return {
      title: { absolute: siteName },
      description,
      alternates,
      robots: { index: false, follow: true },
    };
  }
  const title = isKorean
    ? `${d.name}님은 【${d.essence}】 유형이었어요`
    : `${d.name}さんは【${d.essence}】でした`;
  const ogImage = `${SITE_URL}/og-characters/${d.slug}.jpg`;
  return {
    title: { absolute: `${title}｜${siteName}` },
    description,
    alternates,
    // SNS シェア用の公開ページ。OG クローラには読ませるが、ユーザーごとの
    // URL を検索結果へ大量登録させない。
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${isKorean ? "/ko" : ""}/share/${codePath}`,
      siteName,
      type: "website",
      locale: isKorean ? "ko_KR" : "ja_JP",
      images: [{ url: ogImage, width: 1200, height: 630, alt: d.essence }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function CharacterShareLandingPage({
  params,
  searchParams,
  locale,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  locale: ResultLocale;
}) {
  const { code } = await params;
  const d = await loadShareData(code, locale);
  const isKorean = locale === "ko";

  // 開発用モック: DB に code が無くても ?previewType=<32タイプID> で獲得モードを
  // 確認できる。本番では無効。
  const sp = await searchParams;
  if (!d && process.env.NODE_ENV !== "production") {
    const raw = typeof sp.previewType === "string" ? sp.previewType : "";
    if (
      /^[a-z-]+__[NR]$/.test(raw) &&
      sixteenTypes[baseIdOf(raw as ThirtyTwoTypeId)]
    ) {
      return (
        <MeResultPage
          params={Promise.resolve({ token: `share-${code}` })}
          searchParams={Promise.resolve({})}
          locale={locale}
          share={{
            sharerName:
              (typeof sp.name === "string" && sp.name) ||
              (isKorean ? "미리보기" : "プレビュー"),
            typeId: raw as ThirtyTwoTypeId,
          }}
        />
      );
    }
  }

  // code が引けないときのフォールバック (旧ページの空状態を踏襲)。
  if (!d) {
    return (
      <main
        className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 text-center"
        style={{ background: "#F2EFE6" }}
      >
        <p
          className="font-black text-xs tracking-[0.3em] mb-4"
          style={{ color: NAVY, opacity: 0.6 }}
        >
          {isKorean ? "나의 사용설명서" : "ワタシのトリセツ"}
        </p>
        <h1 className="font-black text-2xl" style={{ color: NAVY }}>
          {isKorean
            ? "나만의 사용설명서를 만들 수 있어요"
            : "あなたのトリセツ、作れます"}
        </h1>
        <p
          className="mt-3 text-sm font-bold"
          style={{ color: NAVY, opacity: 0.7 }}
        >
          {isKorean
            ? "나는 어떤 유형일까요? 무료로 진단해 보세요"
            : "あなたは何タイプ？無料で診断できるよ"}
        </p>
        <Link
          href={isKorean ? "/ko/diagnosis" : "/diagnosis"}
          className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 text-white font-black text-base shadow-sm active:scale-95 transition-transform"
          style={{ background: NAVY }}
        >
          {isKorean ? "무료 성격 진단 시작하기 →" : "無料で性格診断をする →"}
        </Link>
        <p className="mt-3 text-xs" style={{ color: NAVY, opacity: 0.5 }}>
          {isKorean ? "가입 없이 · 무료 · 약 3분" : "登録不要・無料・約3分"}
        </p>
      </main>
    );
  }

  // シェア主タイプの結果ページ (モック/課金導線なし/診断CTA) をまるごと見せる。
  return (
    <MeResultPage
      params={Promise.resolve({ token: `share-${code}` })}
      searchParams={Promise.resolve({})}
      locale={locale}
      share={{ sharerName: d.name, typeId: d.t32 }}
    />
  );
}
