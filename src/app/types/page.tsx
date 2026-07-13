import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { SmoothImage } from "@/components/ui/SmoothImage";
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

// 帯の繋ぎ目の斜めカット量 (右端が左端よりこれだけ下がる)
const SLANT = "clamp(24px, 3.2vw, 64px)";

export const metadata: Metadata = {
  title: "性格タイプ",
  description:
    "ワタシのトリセツの32の性格タイプを、海・陸・空・未知の4つのグループで紹介。Big Five理論ベースの性格診断でわかる、あなたと友達のタイプをチェックしよう。",
  alternates: { canonical: "/types" },
};

// キャラ表示は「真の透過」静止画を使う:
//   public/characters/cut/<slug>.png (Vision で背景除去した透過版。
//   元画像 v3 は他ページ用にそのまま残す)
// ファイルを置くだけで自動登録 (ビルド時に fs 走査、コード変更不要)。
// ⚠️ モーション動画化 (public/characters/motion + TypeMotionVideo) は
// 最後のタスクとして保留中。量産手順は docs/motion-videos.md を参照。
const CUT_DIR = path.join(process.cwd(), "public", "characters", "cut");
const readDirSafe = (dir: string): Set<string> => {
  try {
    return new Set(fs.readdirSync(dir));
  } catch {
    return new Set();
  }
};
const cutFiles = readDirSafe(CUT_DIR);

// slug = 静止画ファイル名のベース (thirtyTwoImagePath から導出)
function slugOf(id: ThirtyTwoTypeId): string {
  return path.basename(thirtyTwoImagePath(id), ".webp");
}

// 表示用静止画: 透過版があればそれ、なければ元画像 (v3) にフォールバック
function displayImagePath(id: ThirtyTwoTypeId): string {
  const file = `${slugOf(id)}.webp`;
  return cutFiles.has(file)
    ? `/characters/cut/${file}`
    : thirtyTwoImagePath(id);
}

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

// OCEAN コード (サブラベル): 診断結果ページと同じ「大文字小文字方式」。
//   高 = 大文字・大きめ・不透明 / 低 = 小文字・小さめ・40% (baseline 揃え)。
//   OCEA は base16 の code (例 "O＋C−E−A＋") から高低を読み、N 軸は __N=高 / __R=低。
function oceanFlags(id: ThirtyTwoTypeId): { letter: string; high: boolean }[] {
  const code = sixteenTypes[baseIdOf(id)].code;
  const ocea = (["O", "C", "E", "A"] as const).map((letter) => ({
    letter: letter as string,
    high: code.includes(`${letter}＋`),
  }));
  return [...ocea, { letter: "N", high: nAxisOf(id) === "N" }];
}

// グループの表示順 (海→陸→空→未知)・見出し。
// giant: 帯の背景に敷く巨大タイポ (16P の「分析家」ポジション)。
const GROUPS: {
  key: ThirtyTwoGroup;
  name: string;
  giant: string;
}[] = [
  { key: "sea", name: "海グループ", giant: "海" },
  { key: "land", name: "陸グループ", giant: "陸" },
  { key: "sky", name: "空グループ", giant: "空" },
  { key: "unknown", name: "未知グループ", giant: "未知" },
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
        {/* ページ見出し + CTA (16P と同じ構成: 見出し直下に診断ボタンだけ置く) */}
        <header className="mx-auto max-w-[1160px] px-6 pt-12 text-center md:pt-16">
          <h1
            className="font-bold"
            style={{
              color: NAVY,
              fontSize: "clamp(38px, 4.8vw, 60px)",
              lineHeight: 1.4,
            }}
          >
            性格タイプ
          </h1>
          <div className="mt-6">
            <Link
              href="/diagnosis"
              className="sora-cta inline-block rounded-full px-14 py-4 text-center text-[20px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5"
            >
              テストを受ける →
            </Link>
          </div>
        </header>

        {/* ヘッダー CTA と最初の帯のあいだにゆとりを持たせる */}
        {/* グループごとの全幅色帯セクション (16P 風)。
            繋ぎ目は 16P と同じ斜めカット: 各帯の上辺を clip-path で「左高・右低」に
            切り、負マージンで前の帯に重ねる (切られた三角形から前の帯の色が覗く)。
            先頭帯は上の白、最終帯は下辺も斜めに切って下の白と斜めに繋がる。 */}
        <div className="mt-16 md:mt-24">
          {GROUPS.map((g, gi) => {
            const ids = byGroup.get(g.key) ?? [];
            const band = BAND_COLOR[g.key];
            const isLast = gi === GROUPS.length - 1;
            return (
              <section
                key={g.key}
                aria-label={g.name}
                className="relative w-full overflow-hidden"
                style={{
                  backgroundColor: band,
                  clipPath: isLast
                    ? `polygon(0 0, 100% ${SLANT}, 100% 100%, 0 calc(100% - ${SLANT}))`
                    : `polygon(0 0, 100% ${SLANT}, 100% 100%, 0 100%)`,
                  marginTop: gi === 0 ? undefined : `calc(0px - ${SLANT})`,
                }}
              >
                {/* 巨大グループ名 (16P の「分析家」ポジション。ソリッドな白、
                    キャラ列が下半分に重なってレイヤー感を出す) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 select-none text-center font-bold leading-none text-white"
                  style={{
                    // 斜めカット (SLANT) の分だけ下げないと、右側で文字がカットの縁に
                    // 触れて窮屈に見える
                    top: `calc(${SLANT} + clamp(20px, 3vw, 56px))`,
                    fontSize: "clamp(150px, 25vw, 380px)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {g.giant}
                </div>

                {/* キャラ列は巨大タイポの下半分に重ねる (pt = 巨大タイポの ~55%) */}
                {/* 横幅制限なし: 帯の中身はビューポート全幅を使い、キャラを最大化する */}
                {/* 下余白は「次の帯の斜めカットに食われる分 (SLANT)」+ 見た目の余白。
                    これがないと最下行の説明文が繋ぎ目ギリギリで窮屈になる */}
                <div
                  className="relative w-full px-3 pt-[clamp(120px,19.5vw,310px)] md:px-8"
                  style={{
                    paddingBottom: `calc(${SLANT} + clamp(56px, 7vw, 110px))`,
                  }}
                >
                  {/* タイプ 8 体 (SP 1 列 / タブレット 2 列 / PC 4 列)。
                      SP は 16P と同じ縦 1 列で 1 体ずつ見せる (画像は上限幅で中央寄せ) */}
                  <div className="grid grid-cols-1 gap-y-14 sm:grid-cols-2 sm:gap-x-2 sm:gap-y-14 md:gap-x-6 lg:grid-cols-4">
                    {ids.map((id) => (
                      <article
                        key={id}
                        // min-w-0: グリッドアイテムが画像の指定幅 (320px) を最小幅として
                        // 主張して列が縮まなくなる (SP で横はみ出しする) のを防ぐ
                        className="flex min-w-0 flex-col items-center text-center"
                      >
                        {/* キャラ: 透過素材の素置き (背景が抜けているので巨大タイポや
                            帯がキャラの輪郭どおりに透けて見える = 16P のレイヤー感)。
                            クリックでそのタイプのフル結果ページ (/preview/[typeId]) へ */}
                        <Link
                          href={`/preview/${id}`}
                          aria-label={`${thirtyTwoEssence(id)}の結果ページを見る`}
                          className="w-full transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]"
                        >
                          <SmoothImage
                            src={displayImagePath(id)}
                            alt={thirtyTwoEssence(id)}
                            width={512}
                            height={512}
                            // 透過キャラを帯/巨大タイポに重ねる設計なので地色の箱は出さない。
                            // ギャラリーは eager で先読みし、スクロールで 1 体ずつ出さずまとめて見せる。
                            placeholderColor="transparent"
                            loading="eager"
                            className="mx-auto h-auto w-full max-w-[420px] sm:max-w-none"
                          />
                        </Link>
                        {/* メイン名 = 肩書き (グループ濃色) / サブ = OCEAN コード。
                            ワイド画面 (xl) ではキャラに合わせて文字も一段大きく */}
                        <h3
                          className="mt-2 text-[24px] font-bold leading-snug md:text-[32px] xl:text-[40px]"
                          style={{ color: DARK_COLOR[g.key] }}
                        >
                          {thirtyTwoEssence(id)}
                        </h3>
                        {/* OCEAN コード: 高 = 大文字・大 / 低 = 小文字・小・40% (診断結果と同仕様) */}
                        <p
                          className="mt-1 flex items-baseline justify-center gap-[3px] text-[18px] font-extrabold leading-none tracking-[0.04em] md:text-[21px] xl:text-[24px]"
                          style={{ color: NAVY }}
                        >
                          {oceanFlags(id).map(({ letter, high }) => (
                            <span
                              key={letter}
                              style={
                                high
                                  ? undefined
                                  : { fontSize: "0.68em", opacity: 0.4 }
                              }
                            >
                              {high ? letter : letter.toLowerCase()}
                            </span>
                          ))}
                        </p>
                        <p
                          className="mt-2 max-w-[330px] text-[15px] leading-relaxed sm:max-w-[240px] sm:text-[14px] md:text-[15px] xl:max-w-[340px] xl:text-[17px]"
                          style={{ color: `${NAVY}B3` }}
                        >
                          {thirtyTwoZukanDesc(id)}
                        </p>
                      </article>
                    ))}
                  </div>

                  {/* 16P と同じ帯中間 CTA: 陸帯の末尾 (陸→空の境目) に設置 */}
                  {g.key === "land" && (
                    <div className="mt-16 text-center md:mt-24">
                      <Link
                        href="/diagnosis"
                        className="sora-cta inline-block rounded-full px-14 py-4 text-center text-[20px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5"
                      >
                        テストを受ける →
                      </Link>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* 診断への CTA (白背景ゾーン) */}
        <section className="py-16 text-center md:py-24">
          <Link
            href="/diagnosis"
            className="sora-cta inline-block rounded-full px-14 py-4 text-center text-[20px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5"
          >
            テストを受ける →
          </Link>
        </section>
      </main>

      <TopFooter />
    </div>
  );
}
