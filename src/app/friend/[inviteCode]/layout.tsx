// /friend/[inviteCode] (友達評価の着地ページ) のメタデータ。
//
// OGP は invite_code からオーナーの32タイプを逆引きし、
// 友達回答依頼用の og-friend/{slug}.jpg (1200x630・32枚) を出す。
// 回答を誘導しないよう、カードのタイトルにはタイプ名を出さない。

import type { Metadata } from "next";
import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  classifyThirtyTwoType,
  thirtyTwoImagePath,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";
import { localizedAlternates } from "@/lib/locale-seo";

const SITE_URL = resolveSiteUrl();
const FALLBACK_DESCRIPTION =
  "あなたから見たわたしを、30問で教えてもらう友達診断";

function buildMetadata(opts: {
  inviteCode: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  url: string;
}): Metadata {
  return {
    title: { absolute: opts.title },
    description: opts.description,
    alternates: localizedAlternates(
      "ja",
      `/friend/${encodeURIComponent(opts.inviteCode)}`,
      `/ko/friend/${encodeURIComponent(opts.inviteCode)}`,
    ),
    // OG クローラ (robots.txt で許可) にはカードを取らせつつ、検索結果には出さない
    // (/share と同方針)。
    robots: { index: false, follow: true },
    openGraph: {
      title: opts.title,
      description: opts.description,
      type: "website",
      siteName: "ワタシのトリセツ",
      url: opts.url,
      images: [
        { url: opts.imageUrl, width: 1200, height: 630, alt: opts.imageAlt },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [opts.imageUrl],
    },
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}): Promise<Metadata> {
  const { inviteCode } = await params;
  const fallback = buildMetadata({
    inviteCode,
    title: "ワタシのトリセツ",
    description: FALLBACK_DESCRIPTION,
    imageUrl: `${SITE_URL}/ogp-v5.jpg`,
    imageAlt: "ワタシのトリセツ",
    url: `${SITE_URL}/friend/${encodeURIComponent(inviteCode)}`,
  });

  // invite_code → オーナーのキャラ slug を逆引きする。
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("display_name, scores")
    .eq("invite_code", inviteCode)
    .maybeSingle();
  if (error) {
    console.error("[/friend/[inviteCode]] metadata lookup error:", error);
  }
  if (!data) return fallback;

  const scores = (data.scores ?? {}) as Partial<
    Record<BigFiveDimension, number>
  >;
  const t32 = classifyThirtyTwoType(scores);
  const slug = thirtyTwoImagePath(t32)
    .split("/")
    .pop()!
    .replace(/\.\w+$/, "");
  const name = ((data.display_name as string | null) ?? "").trim();
  const title = name
    ? `あなたから見た${name}さんを教えて！`
    : "あなたから見たわたしを教えて！";

  return buildMetadata({
    inviteCode,
    title,
    description: name
      ? `あなたから見た${name}さんを、30問でこっそり教えて👀`
      : FALLBACK_DESCRIPTION,
    imageUrl: `${SITE_URL}/og-friend/${slug}.jpg?v=20260825`,
    imageAlt: title,
    url: `${SITE_URL}/friend/${encodeURIComponent(inviteCode)}`,
  });
}

export default function FriendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
