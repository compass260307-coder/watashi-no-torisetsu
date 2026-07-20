// /friend/[inviteCode] (友達評価の着地ページ) のメタデータ。
//
// OGP はキャラ別 (2026-07-15): invite_code からオーナーの32タイプを逆引きし、
// og-characters/{slug}.jpg (1200x630・32枚) を出す。/share/[code] と同じ方式。
// シェアバー (X/LINE/QR) のリンク先はここなので、投稿カードに本人のキャラが出る。
// 逆引き失敗時 (無効コード・preview 等) は従来の汎用 ogp-v4.png にフォールバック。

import type { Metadata } from "next";
import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  classifyThirtyTwoType,
  thirtyTwoEssence,
  thirtyTwoImagePath,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

const SITE_URL = resolveSiteUrl();
const FALLBACK_DESCRIPTION = "友達から見たあなたを30問で教えてもらう診断";

function buildMetadata(opts: {
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  url: string;
}): Metadata {
  return {
    title: { absolute: opts.title },
    description: opts.description,
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
    title: "ワタシのトリセツ",
    description: FALLBACK_DESCRIPTION,
    imageUrl: `${SITE_URL}/ogp-v4.png`,
    imageAlt: "ワタシのトリセツ",
    url: `${SITE_URL}/friend/${encodeURIComponent(inviteCode)}`,
  });

  // invite_code → オーナーの称号/キャラ slug (/share/[code] と同じ逆引き)。
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
  const essence = thirtyTwoEssence(t32);
  const slug = thirtyTwoImagePath(t32)
    .split("/")
    .pop()!
    .replace(/\.\w+$/, "");
  const name = ((data.display_name as string | null) ?? "").trim();

  return buildMetadata({
    title: name
      ? `${name}さんは【${essence}】でした`
      : `私は【${essence}】でした`,
    description: name
      ? `あなたから見た${name}さんを、30問でこっそり教えて👀`
      : FALLBACK_DESCRIPTION,
    imageUrl: `${SITE_URL}/og-characters/${slug}.jpg`,
    imageAlt: essence,
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
