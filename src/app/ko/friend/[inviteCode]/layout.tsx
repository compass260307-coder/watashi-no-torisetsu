import type { Metadata } from "next";
import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  KO_DEFAULT_OG_IMAGE,
  KO_SITE_NAME,
  localizedAlternates,
} from "@/lib/locale-seo";

const SITE_URL = resolveSiteUrl();
const FALLBACK_TITLE = "친구 진단 | 앨리스 진단";
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
      siteName: KO_SITE_NAME,
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
    imageUrl: `${SITE_URL}${KO_DEFAULT_OG_IMAGE.url}`,
    imageAlt: KO_DEFAULT_OG_IMAGE.alt,
  });

  const { data } = await supabaseAdmin
    .from("users")
    .select("display_name")
    .eq("invite_code", inviteCode)
    .maybeSingle();
  if (!data) return fallback;

  const name = ((data.display_name as string | null) ?? "").trim();

  return metadataForInvite({
    inviteCode,
    // 日本語版と同じく、回答を誘導しないよう本人のタイプ名は出さない。
    title: name
      ? `네가 보는 ${name}님을 알려 줘!`
      : "네가 보는 나를 알려 줘!",
    description: name
      ? `친구의 눈에 비친 ${name}님의 모습을 30개 질문으로 알려 주세요.`
      : FALLBACK_DESCRIPTION,
    imageUrl: `${SITE_URL}${KO_DEFAULT_OG_IMAGE.url}`,
    imageAlt: KO_DEFAULT_OG_IMAGE.alt,
  });
}

export default function KoreanFriendInviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
