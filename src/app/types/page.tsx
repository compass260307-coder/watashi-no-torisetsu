import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import {
  allThirtyTwoTypeIds,
  thirtyTwoName,
  thirtyTwoEssence,
  thirtyTwoZukanDesc,
  thirtyTwoImagePath,
  thirtyTwoGroup,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import {
  THIRTY_TWO_GROUP_COLOR,
  type ThirtyTwoGroup,
} from "@/lib/thirty-two-content/character-32";

// /types: 性格タイプ一覧 (16Personalities の /ja/性格タイプ を参考にした構成)。
//   構成: ページ見出し + リード → グループごとのセクション (帯見出し + タイプカード
//   8 枚のグリッド) × 4 → 診断への CTA。
//   データは 32 タイプの既存ライブラリ (lib/thirty-two-*) をそのまま参照し、
//   このページ独自のタイプ文言は持たない (グループ紹介文のみ ⚠️ 仮文言)。
//   トーンはトップページ (TopHeader/TopFooter、Noto Sans、白背景 + ネイビー) に合わせる。

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";

// ⚠️ ナビ公開前のため一旦 noindex (ヘッダー/フッターの「性格タイプ（準備中）」を
// リンク化するタイミングで index に切り替え + sitemap 追加する)。
export const metadata: Metadata = {
  title: "性格タイプ",
  description:
    "ワタシのトリセツの32の性格タイプを、空・海・陸・未知の4つのグループで紹介。Big Five理論ベースの性格診断でわかる、あなたと友達のタイプをチェックしよう。",
  robots: { index: false, follow: false },
};

// グループの表示順・見出し・紹介文 (⚠️ 紹介文は仮。データ側に正本ができたら移す)
const GROUPS: {
  key: ThirtyTwoGroup;
  name: string;
  lede: string;
}[] = [
  {
    key: "sky",
    name: "空グループ",
    lede: "頭の中に、広い世界を持っている。ことばと想像で世界をとらえる、思索派のタイプたち。",
  },
  {
    key: "sea",
    name: "海グループ",
    lede: "人と人のあいだを、じょうずに泳いでいく。共感と社交で流れをつくるタイプたち。",
  },
  {
    key: "land",
    name: "陸グループ",
    lede: "みんなの真ん中で、場をあたためる。行動力と安心感でまわりを支えるタイプたち。",
  },
  {
    key: "unknown",
    name: "未知グループ",
    lede: "じぶんだけの理想と芯を、しずかに貫く。ちょっと不思議なロマン派のタイプたち。",
  },
];

export default function TypesPage() {
  // 32 タイプをグループごとに振り分け (データ定義順を維持)
  const byGroup = new Map<ThirtyTwoGroup, ThirtyTwoTypeId[]>();
  for (const id of allThirtyTwoTypeIds()) {
    const g = thirtyTwoGroup(id);
    byGroup.set(g, [...(byGroup.get(g) ?? []), id]);
  }

  return (
    <div className="flex flex-1 flex-col bg-white" style={{ fontFamily: FONT_STACK }}>
      <TopHeader />

      <main className="mx-auto w-full max-w-[1160px] px-6 pb-20 pt-12 md:pt-16">
        {/* ページ見出し + リード */}
        <header className="text-center">
          <h1
            className="font-bold"
            style={{
              color: NAVY,
              fontSize: "clamp(28px, 3.4vw, 44px)",
              lineHeight: 1.4,
            }}
          >
            性格タイプ
          </h1>
          <p
            className="mx-auto mt-4 max-w-[680px] text-[15px] leading-[1.9] text-[#5A5A7A] md:text-[17px]"
          >
            ワタシのトリセツの性格タイプは、ぜんぶで32種類。
            住んでいる世界ごとに「空・海・陸・未知」の4つのグループに分かれています。
            あなたは、そして友達は、どのタイプ?
          </p>
        </header>

        {/* グループごとのセクション */}
        {GROUPS.map((g) => {
          const ids = byGroup.get(g.key) ?? [];
          const color = THIRTY_TWO_GROUP_COLOR[g.key];
          return (
            <section key={g.key} className="mt-14 md:mt-20" aria-label={g.name}>
              {/* グループ見出し (色チップ + 名前 + リード) */}
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-7 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <h2
                  className="font-bold"
                  style={{ color: NAVY, fontSize: "clamp(21px, 2.4vw, 30px)" }}
                >
                  {g.name}
                </h2>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#5A5A7A] md:text-[16px]">
                {g.lede}
              </p>

              {/* タイプカード (SP 2 列 / PC 4 列) */}
              <div className="mt-6 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
                {ids.map((id) => (
                  <article
                    key={id}
                    className="flex flex-col items-center rounded-2xl border border-[#2E2E5C]/10 bg-white p-4 text-center shadow-[0_4px_14px_rgba(46,46,92,0.06)]"
                  >
                    {/* キャラ画像 (グループ色の薄い円形背景に載せる) */}
                    <div
                      className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full md:h-28 md:w-28"
                      style={{ backgroundColor: `${color}33` }}
                    >
                      <Image
                        src={thirtyTwoImagePath(id)}
                        alt={thirtyTwoName(id)}
                        width={112}
                        height={112}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p
                      className="mt-3 text-[11px] font-bold tracking-wide md:text-[12px]"
                      style={{ color }}
                    >
                      {thirtyTwoEssence(id)}
                    </p>
                    <h3
                      className="mt-1 text-[15px] font-bold leading-snug md:text-[16px]"
                      style={{ color: NAVY }}
                    >
                      {thirtyTwoName(id)}
                    </h3>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[#8A8AA3] md:text-[13px]">
                      {thirtyTwoZukanDesc(id)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        {/* 診断への CTA */}
        <section className="mt-16 text-center md:mt-24">
          <h2
            className="font-bold"
            style={{ color: NAVY, fontSize: "clamp(20px, 2.2vw, 28px)" }}
          >
            あなたのタイプは、15問でわかる。
          </h2>
          <div className="mt-6">
            <Link
              href="/diagnosis"
              className="sora-cta inline-block rounded-full px-14 py-4 text-center text-[18px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5"
              style={{ boxShadow: "0 8px 20px rgba(91,91,239,0.30)" }}
            >
              無料で診断をはじめる →
            </Link>
          </div>
        </section>
      </main>

      <TopFooter />
    </div>
  );
}
