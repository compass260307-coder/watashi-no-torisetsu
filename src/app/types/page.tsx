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
//   16P 風の演出: グループごとに全幅の色帯セクション + 帯の上に巨大グループ名 +
//   その手前にキャラを並べる。テキストは帯の上に直接載せる (白カードで区切らない)。
//   ⚠️ 現行キャラ画像は背景つきスクエア (透過なし) のため円形クロップで統一し、
//   白リング + ドロップシャドウで立体感を出す。背景透過の全身立ち絵が用意でき次第、
//   16P 同様「キャラが帯の上に立つ」構図に差し替える (円形 <div> を <Image> 直置きに)。
//   データは 32 タイプの既存ライブラリ (lib/thirty-two-*) をそのまま参照し、
//   このページ独自のタイプ文言は持たない (グループ紹介文のみ ⚠️ 仮文言)。

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

// グループの表示順・見出し・紹介文 (⚠️ 紹介文は仮。データ側に正本ができたら移す)。
// giant: 帯の背景に敷く巨大タイポ (16P の「分析家」ポジション)。
const GROUPS: {
  key: ThirtyTwoGroup;
  name: string;
  giant: string;
  lede: string;
}[] = [
  {
    key: "sky",
    name: "空グループ",
    giant: "空",
    lede: "頭の中に、広い世界を持っている。ことばと想像で世界をとらえる、思索派のタイプたち。",
  },
  {
    key: "sea",
    name: "海グループ",
    giant: "海",
    lede: "人と人のあいだを、じょうずに泳いでいく。共感と社交で流れをつくるタイプたち。",
  },
  {
    key: "land",
    name: "陸グループ",
    giant: "陸",
    lede: "みんなの真ん中で、場をあたためる。行動力と安心感でまわりを支えるタイプたち。",
  },
  {
    key: "unknown",
    name: "未知グループ",
    giant: "未知",
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
    <div
      className="flex flex-1 flex-col bg-white"
      style={{ fontFamily: FONT_STACK }}
    >
      <TopHeader />

      <main className="w-full pb-0">
        {/* ページ見出し + リード (白背景ゾーン) */}
        <header className="mx-auto max-w-[1160px] px-6 pt-12 text-center md:pt-16">
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
          <p className="mx-auto mt-4 max-w-[680px] text-[15px] leading-[1.9] text-[#5A5A7A] md:text-[17px]">
            ワタシのトリセツの性格タイプは、ぜんぶで32種類。
            住んでいる世界ごとに「空・海・陸・未知」の4つのグループに分かれています。
            あなたは、そして友達は、どのタイプ?
          </p>
        </header>

        {/* グループごとの全幅色帯セクション (16P 風) */}
        <div className="mt-12 md:mt-16">
          {GROUPS.map((g) => {
            const ids = byGroup.get(g.key) ?? [];
            const color = THIRTY_TWO_GROUP_COLOR[g.key];
            return (
              <section
                key={g.key}
                aria-label={g.name}
                className="relative w-full overflow-hidden"
                style={{
                  // 帯: グループ色 → わずかに白へ抜けるグラデで平板さを回避
                  background: `linear-gradient(180deg, ${color} 0%, ${color}CC 100%)`,
                }}
              >
                {/* 巨大グループ名 (帯の背景に敷く白タイポ。キャラが少し重なる) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-2 select-none text-center font-bold leading-none text-white/80 md:top-4"
                  style={{
                    fontSize: "clamp(110px, 18vw, 260px)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {g.giant}
                </div>

                <div className="relative mx-auto max-w-[1160px] px-6 pb-12 pt-[clamp(70px,12vw,170px)] md:pb-16">
                  {/* グループ紹介 (巨大タイポの下・キャラ列の上) */}
                  <p
                    className="mx-auto max-w-[620px] text-center text-[14px] font-bold leading-relaxed md:text-[16px]"
                    style={{ color: NAVY }}
                  >
                    {g.lede}
                  </p>

                  {/* タイプ 8 体 (SP 2 列 / PC 4 列)。白リング円形 + 影で立体感を統一 */}
                  <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:mt-10 md:gap-x-6 lg:grid-cols-4">
                    {ids.map((id) => (
                      <article
                        key={id}
                        className="flex flex-col items-center text-center"
                      >
                        <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white shadow-[0_14px_28px_rgba(46,46,92,0.28)] md:h-36 md:w-36">
                          <Image
                            src={thirtyTwoImagePath(id)}
                            alt={thirtyTwoName(id)}
                            width={144}
                            height={144}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <h3
                          className="mt-4 text-[15px] font-bold leading-snug md:text-[17px]"
                          style={{ color: NAVY }}
                        >
                          {thirtyTwoName(id)}
                        </h3>
                        <p
                          className="mt-0.5 text-[11px] font-bold tracking-[0.08em] md:text-[12px]"
                          style={{ color: `${NAVY}99` }}
                        >
                          {thirtyTwoEssence(id)}
                        </p>
                        <p
                          className="mt-1.5 max-w-[220px] text-[12px] leading-relaxed md:text-[13px]"
                          style={{ color: `${NAVY}B3` }}
                        >
                          {thirtyTwoZukanDesc(id)}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* 診断への CTA (白背景ゾーン) */}
        <section className="py-16 text-center md:py-24">
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
