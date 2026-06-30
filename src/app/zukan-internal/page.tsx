// 32キャラ図鑑 (隠しルート /zukan-internal)
//
// 社内デバッグ表 → 「32キャラ図鑑」へ作り込み (docs/zukan仕様書.md 準拠)。
// 軽量版・索引特化: 本文 (恋愛/取説) はカードに載せず、詳細は各カードから
// /preview/[id] (フル結果ページ) へ飛ばす。noindex の隠しルートのまま (導線なし)。
//
// データソース: character-32.ts / sixteen-types.ts のリゾルバのみ (thirty-two-types.ts 経由)。
//   ※ /zukan-mine・/zukan・zukan-data/helpers (8タイプ系) とは別物。混同しない。
//
// ★キャラ名 = essence (先導者・探偵…)。旧 name (動物名「れいせいシャチ」等) は廃止・非表示。

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { sixteenTypes, type SixteenTypeId } from "@/lib/sixteen-types";
import {
  THIRTY_TWO_GROUP_COLOR,
  type ThirtyTwoGroup,
} from "@/lib/thirty-two-content/character-32";
import {
  type ThirtyTwoTypeId,
  thirtyTwoEssence,
  thirtyTwoOneLiner,
  thirtyTwoImagePath,
  thirtyTwoColor,
  thirtyTwoGroup,
  nAxisOf,
} from "@/lib/thirty-two-types";
import { CopyPath } from "./CopyPath";

export const metadata: Metadata = {
  title: "32キャラ図鑑 (社内)",
  robots: { index: false, follow: false },
};

// カード背景のウォッシュ色 (淡色)。preview/all の GROUP_BG と同値で揃える。
// アクセント色 (THIRTY_TWO_GROUP_COLOR) とは別系統 (画像が映える淡い背景)。
const GROUP_WASH: Record<ThirtyTwoGroup, string> = {
  sky: "#FDEFB4", // 空 (黄)
  sea: "#BEF2F9", // 海 (青)
  land: "#D8F2C0", // 陸 (緑)
  unknown: "#E7DCFB", // 未知 (紫)
};

interface GroupDef {
  emoji: string;
  label: string;
  colorName: string; // 見出しの色名表記 (説明用)
  groupKey: ThirtyTwoGroup; // 色は THIRTY_TWO_GROUP_COLOR[groupKey] から引く (ハードコードしない)
  base16: SixteenTypeId[]; // C×A の4スロット (この順で表示)
}

// グループ = base16 の E×O。各 base16 の __N(繊細)/__R(鉄壁) で 8体。
const GROUPS: GroupDef[] = [
  {
    emoji: "🕊",
    label: "空",
    colorName: "黄",
    groupKey: "sky",
    base16: ["quiet-owl", "seeker-wolf", "dreamer-rabbit", "fantasy-cat"],
  },
  {
    emoji: "🌿",
    label: "陸",
    colorName: "緑",
    groupKey: "land",
    base16: ["caretaker-dog", "brisk-tiger", "smiley-panda", "playful-raccoon"],
  },
  {
    emoji: "🌊",
    label: "海",
    colorName: "青",
    groupKey: "sea",
    base16: ["sparkle-dolphin", "ambition-lion", "idea-monkey", "whim-fox"],
  },
  {
    emoji: "✨",
    label: "未知",
    colorName: "紫",
    groupKey: "unknown",
    base16: ["earnest-elephant", "steady-turtle", "gentle-koala", "solo-hedgehog"],
  },
];

// code 例 "O＋C＋E−A＋" → 各軸の符号 (＋/−)
function signs(code: string): { O: string; C: string; E: string; A: string } {
  return { O: code[1], C: code[3], E: code[5], A: code[7] };
}

// Big Five コード (OCEAN・高=大文字/低=小文字)。N は神経症 (接尾 _N=高/_R=低)。
//   例: 先導者 ENFJ_R → O高C高E高A高N低 = "OCEAn"
function bigFiveCode(id: ThirtyTwoTypeId): string {
  const base16 = id.slice(0, id.lastIndexOf("__")) as SixteenTypeId;
  const s = signs(sixteenTypes[base16].code);
  const hi = (sign: string, ch: string) =>
    sign === "＋" ? ch.toUpperCase() : ch.toLowerCase();
  return (
    hi(s.O, "o") +
    hi(s.C, "c") +
    hi(s.E, "e") +
    hi(s.A, "a") +
    (nAxisOf(id) === "N" ? "N" : "n")
  );
}

// MBTI コード (ENFJ_R 等)。Big Five 符号から導出。
//   E:E＋→E/E−→I  N(直感):O＋→N/O−→S  F:A＋→F/A−→T  J:C＋→J/C−→P  接尾:_N|_R
function mbtiCode(id: ThirtyTwoTypeId): string {
  const base16 = id.slice(0, id.lastIndexOf("__")) as SixteenTypeId;
  const s = signs(sixteenTypes[base16].code);
  const e = s.E === "＋" ? "E" : "I";
  const ns = s.O === "＋" ? "N" : "S";
  const ft = s.A === "＋" ? "F" : "T";
  const jp = s.C === "＋" ? "J" : "P";
  return `${e}${ns}${ft}${jp}_${nAxisOf(id)}`;
}

function CharCard({ id }: { id: ThirtyTwoTypeId }) {
  const n = nAxisOf(id);
  const nLabel = n === "N" ? "繊細 (N高)" : "鉄壁 (N低)";
  const accent = thirtyTwoColor(id);
  const wash = GROUP_WASH[thirtyTwoGroup(id)];
  const imgPath = thirtyTwoImagePath(id);
  const filePath = `/characters/v3/${imgPath.split("/").pop()}`;

  return (
    <div
      className="rounded-2xl border-2 border-[#3A2D6B]/10 p-4 flex flex-col items-center text-center"
      style={{ background: wash }}
    >
      {/* 1. 画像 (大きめ 128px) */}
      <Image
        src={imgPath}
        alt={thirtyTwoEssence(id)}
        width={160}
        height={160}
        className="w-[128px] h-[128px] rounded-2xl bg-white/50 object-cover"
      />

      {/* N軸バッジ (アクセント色) */}
      <span
        className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full text-[#3A2D6B] mt-3"
        style={{ background: accent }}
      >
        {nLabel}
      </span>

      {/* 2. キャラ名 (= essence。カードの主役・最大文字) */}
      <h3 className="text-[#3A2D6B] font-black text-2xl leading-tight mt-1">
        {thirtyTwoEssence(id)}
      </h3>

      {/* 3-4. Big Five コード + MBTI コード */}
      <div className="flex items-center gap-2 mt-2">
        <span
          className="font-mono font-black text-base tracking-[0.15em] text-[#3A2D6B]"
          title="Big Five (高=大文字/低=小文字。末尾Nは神経症)"
        >
          {bigFiveCode(id)}
        </span>
        <span className="font-mono text-xs font-bold text-[#3A2D6B]/60">
          {mbtiCode(id)}
        </span>
      </div>

      {/* 5. 一言説明文 (★後日確定。暫定で oneLiner を流用・プレースホルダ表示) */}
      <p className="text-[#3A2D6B]/45 text-xs leading-relaxed mt-2">
        {thirtyTwoOneLiner(id)}
        <span className="block text-[10px] text-[#3A2D6B]/35 mt-0.5">
          (説明文は後日)
        </span>
      </p>

      {/* 6. 結果ページ (フル結果へ) */}
      <Link
        href={`/preview/${id}`}
        className="mt-3 inline-block rounded-full bg-[#3A2D6B] text-white text-xs font-black px-4 py-2 hover:bg-[#2c2152] transition-colors"
      >
        結果ページを見る →
      </Link>

      {/* 7. 画像パス (SNS/HP 用・コピー可) */}
      <div className="w-full mt-3 pt-2 border-t border-[#3A2D6B]/10">
        <CopyPath path={filePath} />
      </div>
    </div>
  );
}

export default function ZukanInternalPage() {
  return (
    <main className="min-h-screen bg-[#E4E0F5] py-6 px-4">
      <div className="max-w-[960px] mx-auto">
        <header className="bg-white rounded-2xl border-2 border-[#0094D8]/30 p-5 mb-6">
          <p className="text-[#FE3C72] font-black text-xs tracking-widest mb-1">
            INTERNAL ONLY / 社内資料
          </p>
          <h1 className="text-[#3A2D6B] font-black text-2xl mb-3">32キャラ図鑑</h1>
          <div className="text-xs text-[#3A2D6B]/75 leading-relaxed space-y-1">
            <p className="font-black text-[#3A2D6B]">
              グループ = base16 の E×O / N高=繊細(__N)・N低=鉄壁(__R)
            </p>
            <p>🕊 空 (黄 {THIRTY_TWO_GROUP_COLOR.sky}) = 詩人 / 賢者 / 理論家 / ストラテジスト / 空想家 / 表現者 / 収集家 / 職人</p>
            <p>🌿 陸 (緑 {THIRTY_TWO_GROUP_COLOR.land}) = アテンダント / 幹事 / 師範 / 支配人 / 演出家 / 楽天家 / 開拓者 / 勝負師</p>
            <p>🌊 海 (青 {THIRTY_TWO_GROUP_COLOR.sea}) = 寄添者 / 先導者 / 采配者 / 将軍 / ジャーナリスト / フェススター / 弁才家 / 革命家</p>
            <p>🔮 未知 (紫 {THIRTY_TWO_GROUP_COLOR.unknown}) = 夢想家 / 守護者 / 飛翔家 / 不屈者 / 審美者 / 数寄者 / 探偵 / 風雲児</p>
            <p className="text-[#3A2D6B]/55">
              ※ Big Five コードは OCEAN の順で高=大文字・低=小文字 (末尾Nは神経症)。MBTI の N(直感) とは別物。
            </p>
            <p className="text-[#3A2D6B]/55">
              ※ 一言説明文は暫定 (後日の文言確定タスクで差し替え予定)。
            </p>
          </div>
        </header>

        {GROUPS.map((g) => {
          const barColor = THIRTY_TWO_GROUP_COLOR[g.groupKey];
          return (
            <section key={g.label} className="mb-8">
              <h2
                className="rounded-xl px-4 py-2 mb-3 text-[#3A2D6B] font-black text-lg flex items-center gap-2"
                style={{ background: barColor }}
              >
                <span>{g.emoji}</span>
                <span>
                  {g.label}グループ（{g.colorName}）
                </span>
                <span className="font-mono text-xs font-bold opacity-70">
                  {barColor}
                </span>
              </h2>

              <div className="space-y-3">
                {g.base16.map((b) => {
                  const s = signs(sixteenTypes[b].code);
                  return (
                    <div key={b}>
                      <p className="text-[#3A2D6B]/55 text-[11px] font-bold mb-1.5">
                        {b}（C{s.C} × A{s.A}） — 繊細 / 鉄壁ペア
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <CharCard id={`${b}__N` as ThirtyTwoTypeId} />
                        <CharCard id={`${b}__R` as ThirtyTwoTypeId} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <footer className="text-center text-[#3A2D6B]/45 text-xs pb-8">
          全32キャラ ・ 内部資料 ・ 一般導線なし(直URLのみ)
        </footer>
      </div>
    </main>
  );
}
