// キャラシェア着地ページ /share/{invite_code} (拡散=新規獲得)。
//   - per-owner OG: そのオーナーの称号キャラOGカードを og:image に出す。
//   - 目的: 踏んだ人を /diagnosis (新規診断) に誘導する獲得ランディング。
//   - ⚠ /friend(評価依頼) や /me(private) には誘導しない。純粋な拡散導線。
//   - invite_code は既に公開値 (/friend でも使用)。ここでは display_name + type を逆引きし、
//     32タイプの称号・キャラ画像・OGカードに解決する。

import type { Metadata } from "next";
import { resolveSiteUrl } from "@/lib/site-url";
import Link from "next/link";
import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  classifyThirtyTwoType,
  thirtyTwoEssence,
  thirtyTwoImagePath,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

const SITE_URL =
  resolveSiteUrl();
const NAVY = "#2A3A5C";

interface ShareData {
  name: string;
  essence: string;
  slug: string;
}

// invite_code → display_name + scores → 32タイプの称号/slug に解決。無ければ null。
async function loadShareData(code: string): Promise<ShareData | null> {
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
  const essence = thirtyTwoEssence(t32);
  // thirtyTwoImagePath = /characters/v3/{slug}.png → slug を取り出し og-characters/{slug}.jpg に。
  const slug = thirtyTwoImagePath(t32)
    .split("/")
    .pop()!
    .replace(".png", "");
  const name = ((data.display_name as string | null) ?? "").trim() || "ある人";
  return { name, essence, slug };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const d = await loadShareData(code);
  const description = "あなたは何タイプ？30秒で診断できるよ";
  if (!d) {
    return {
      title: "ワタシのトリセツ",
      description,
    };
  }
  const title = `${d.name}さんは【${d.essence}】でした`;
  const ogImage = `${SITE_URL}/og-characters/${d.slug}.jpg`;
  return {
    title: `${title}｜ワタシのトリセツ`,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/share/${code}`,
      siteName: "ワタシのトリセツ",
      type: "website",
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

export default async function SharePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const d = await loadShareData(code);

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 text-center"
      style={{ background: "#F2EFE6" }}
    >
      <p
        className="font-black text-xs tracking-[0.3em] mb-4"
        style={{ color: NAVY, opacity: 0.6 }}
      >
        ワタシのトリセツ
      </p>

      {d ? (
        <>
          <Image
            src={`/characters/v3/${d.slug}.png`}
            alt={d.essence}
            width={320}
            height={320}
            className="w-56 h-56 md:w-64 md:h-64 object-contain"
            priority
          />
          <h1
            className="mt-4 font-black text-2xl leading-snug"
            style={{ color: NAVY }}
          >
            {d.name}さんは
            <br />
            「{d.essence}」でした
          </h1>
        </>
      ) : (
        <h1 className="font-black text-2xl" style={{ color: NAVY }}>
          あなたのトリセツ、作れます
        </h1>
      )}

      <p className="mt-3 text-sm font-bold" style={{ color: NAVY, opacity: 0.7 }}>
        あなたは何タイプ？30秒で診断できるよ
      </p>

      {/* 唯一の導線 = 新規診断へ。/friend(評価) や /me(private) には出さない。 */}
      <Link
        href="/diagnosis"
        className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 text-white font-black text-base shadow-sm active:scale-95 transition-transform"
        style={{ background: NAVY }}
      >
        あなたも診断する →
      </Link>
      <p className="mt-3 text-xs" style={{ color: NAVY, opacity: 0.5 }}>
        登録不要・無料・約3分
      </p>
    </main>
  );
}
