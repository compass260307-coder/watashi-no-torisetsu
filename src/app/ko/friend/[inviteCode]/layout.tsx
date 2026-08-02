import type { Metadata } from "next";
import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  classifyThirtyTwoType,
  thirtyTwoImagePath,
} from "@/lib/thirty-two-types";
import { KO_RESULT_TYPES } from "@/i18n/ko/result";
import type { BigFiveDimension } from "@/lib/types";
import { localizedAlternates } from "@/lib/locale-seo";

const SITE_URL = resolveSiteUrl();
const FALLBACK_TITLE = "친구 진단 | 나의 사용설명서";
const FALLBACK_DESCRIPTION =
  "친구의 눈에 비친 모습을 30개 질문으로 알려 주세요.";

function metadataForInvite({
  inviteCode,
  title,
  description,
  imageUrl,
  imageAlt,
}: {
  inviteCode: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
}): Metadata {
  const url = `${SITE_URL}/ko/friend/${encodeURIComponent(inviteCode)}`;
  return {
    title: { absolute: title },
    description,
    alternates: localizedAlternates(
      "ko",
      `/friend/${encodeURIComponent(inviteCode)}`,
      `/ko/friend/${encodeURIComponent(inviteCode)}`,
    ),
    robots: { index: false, follow: true },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: "나의 사용설명서",
      title,
      description,
      url,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}): Promise<Metadata> {
  const { inviteCode } = await params;
  const fallback = metadataForInvite({
    inviteCode,
    title: FALLBACK_TITLE,
    description: FALLBACK_DESCRIPTION,
    imageUrl: `${SITE_URL}/ogp-v4.png`,
    imageAlt: "나의 사용설명서 친구 진단",
  });

  const { data } = await supabaseAdmin
    .from("users")
    .select("display_name, scores")
    .eq("invite_code", inviteCode)
    .maybeSingle();
  if (!data) return fallback;

  const scores = (data.scores ?? {}) as Partial<
    Record<BigFiveDimension, number>
  >;
  const type32 = classifyThirtyTwoType(scores);
  const copy = KO_RESULT_TYPES[type32];
  const slug = thirtyTwoImagePath(type32)
    .split("/")
    .pop()!
    .replace(/\.\w+$/, "");
  const name = ((data.display_name as string | null) ?? "").trim();

  return metadataForInvite({
    inviteCode,
    title: name
      ? `${name}님은 ‘${copy.essence}’ 유형이에요`
      : `나는 ‘${copy.essence}’ 유형이에요`,
    description: name
      ? `친구의 눈에 비친 ${name}님의 모습을 30개 질문으로 알려 주세요.`
      : FALLBACK_DESCRIPTION,
    imageUrl: `${SITE_URL}/og-characters/${slug}.jpg`,
    imageAlt: copy.name,
  });
}

export default function KoreanFriendInviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
