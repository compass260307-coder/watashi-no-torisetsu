import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import {
  allThirtyTwoTypeIds,
  thirtyTwoEssence,
  thirtyTwoZukanDesc,
  thirtyTwoImagePath,
  thirtyTwoGroup,
  baseIdOf,
  nAxisOf,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { sixteenTypes } from "@/lib/sixteen-types";
import { type ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";

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

// 帯の背景色 = キャラ画像 (v3) の背景色そのもの (全 32 枚を実測、グループ内で完全一致)。
// 画像とベタ続きになり境界が消える = 透過素材なしで「キャラが帯の上にいる」ように見せる。
// ⚠️ v3 画像を差し替えるときは背景色もここと揃えること。
const BAND_COLOR: Record<ThirtyTwoGroup, string> = {
  sky: "#FDEFB4", // 空・ペールイエロー
  sea: "#BEF2F9", // 海・ペールシアン
  land: "#D8F2C0", // 陸・ペールグリーン
  unknown: "#E7DCFB", // 未知・ペールラベンダー
};

// メイン名 (肩書き) の文字色 = 各グループ色の濃いバージョン (帯の上で読めるコントラスト)
const DARK_COLOR: Record<ThirtyTwoGroup, string> = {
  sky: "#8F6B14",
  sea: "#1D6E86",
  land: "#3F7A2E",
  unknown: "#6C4EB8",
};

// OCEAN コード (サブラベル): base16 の OCEA 高低コード + N 軸 (__N=＋ / __R=−)
function oceanCode(id: ThirtyTwoTypeId): string {
  const nSign = nAxisOf(id) === "N" ? "＋" : "−";
  return `${sixteenTypes[baseIdOf(id)].code}N${nSign}`;
}

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
            const band = BAND_COLOR[g.key];
            return (
              <section
                key={g.key}
                aria-label={g.name}
                className="relative w-full overflow-hidden"
                style={{ backgroundColor: band }}
              >
                {/* 巨大グループ名 (16P の「分析家」ポジション。ソリッドな白、
                    キャラ列が下半分に重なってレイヤー感を出す) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-[clamp(8px,2vw,28px)] select-none text-center font-bold leading-none text-white"
                  style={{
                    fontSize: "clamp(120px, 19vw, 280px)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {g.giant}
                </div>

                {/* キャラ列は巨大タイポの下半分に重ねる (pt = 巨大タイポの ~55%) */}
                {/* コンテナ広め (1360px)・左右パディング/列間を詰めて、キャラに横幅を最大限使わせる */}
                <div className="relative mx-auto max-w-[1360px] px-3 pb-10 pt-[clamp(80px,12.5vw,190px)] md:px-6 md:pb-14">
                  {/* タイプ 8 体 (SP 2 列 / PC 4 列)。画像は列幅いっぱい (w-full) */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-10 md:gap-x-4 lg:grid-cols-4">
                    {ids.map((id) => (
                      <article
                        key={id}
                        // min-w-0: グリッドアイテムが画像の指定幅 (320px) を最小幅として
                        // 主張して列が縮まなくなる (SP で横はみ出しする) のを防ぐ
                        className="flex min-w-0 flex-col items-center text-center"
                      >
                        {/* キャラ: 枠・影・クロップなしの素置き。画像背景 = 帯色なので
                            境界が消えて帯の上にいるように見える (16P 風) */}
                        <Image
                          src={thirtyTwoImagePath(id)}
                          alt={thirtyTwoEssence(id)}
                          width={320}
                          height={320}
                          className="h-auto w-full"
                        />
                        {/* メイン名 = 肩書き (グループ濃色) / サブ = OCEAN コード */}
                        <h3
                          className="mt-2 text-[18px] font-bold leading-snug md:text-[22px]"
                          style={{ color: DARK_COLOR[g.key] }}
                        >
                          {thirtyTwoEssence(id)}
                        </h3>
                        <p
                          className="mt-1 text-[12px] font-bold tracking-[0.06em] md:text-[13px]"
                          style={{ color: `${NAVY}99` }}
                        >
                          {oceanCode(id)}
                        </p>
                        <p
                          className="mt-2 max-w-[240px] text-[13px] leading-relaxed md:text-[14px]"
                          style={{ color: `${NAVY}B3` }}
                        >
                          {thirtyTwoZukanDesc(id)}
                        </p>
                      </article>
                    ))}
                  </div>

                  {/* グループ紹介 (16P に合わせ帯の主役はキャラ。紹介文は末尾に小さく) */}
                  <p
                    className="mx-auto mt-10 max-w-[620px] text-center text-[13px] font-bold leading-relaxed md:text-[14px]"
                    style={{ color: `${NAVY}CC` }}
                  >
                    {g.lede}
                  </p>
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
