// 社内用 32キャラ・リファレンス (隠しルート /zukan-internal)
//
// チーム内資料。内部ID(ThirtyTwoTypeId)・Big Five記号を出すため一般ユーザー向けではない。
// トップ/ナビからの導線は張らない (直URLを知る人だけが見る)。noindex。
// データは character-32.ts / sixteen-types.ts の resolver から引く (正確性優先)。
// 本番16データ・既存ページは無改変。フラグ非依存で常に表示 (社内資料)。

import Image from "next/image";
import type { Metadata } from "next";
import { sixteenTypes, type SixteenTypeId } from "@/lib/sixteen-types";
import {
  type ThirtyTwoTypeId,
  thirtyTwoEssence,
  thirtyTwoOneLiner,
  thirtyTwoImagePath,
  thirtyTwoColor,
  nAxisOf,
} from "@/lib/thirty-two-types";

export const metadata: Metadata = {
  title: "32キャラ 社内リファレンス",
  robots: { index: false, follow: false },
};

interface GroupDef {
  emoji: string;
  label: string;
  color: string;
  base16: SixteenTypeId[]; // C×A の4スロット (この順で表示)
}

// グループ = base16 の E×O。各 base16 の __N(繊細)/__R(鉄壁) で 8体。
const GROUPS: GroupDef[] = [
  {
    emoji: "🕊",
    label: "空",
    color: "#A8D88A",
    base16: ["quiet-owl", "seeker-wolf", "dreamer-rabbit", "fantasy-cat"],
  },
  {
    emoji: "🌿",
    label: "陸",
    color: "#F5A9C0",
    base16: ["caretaker-dog", "brisk-tiger", "smiley-panda", "playful-raccoon"],
  },
  {
    emoji: "🌊",
    label: "海",
    color: "#8EC5E8",
    base16: ["sparkle-dolphin", "ambition-lion", "idea-monkey", "whim-fox"],
  },
  {
    emoji: "✨",
    label: "未知",
    color: "#C3A0E0",
    base16: ["earnest-elephant", "steady-turtle", "gentle-koala", "solo-hedgehog"],
  },
];

// code 例 "O＋C＋E−A＋" → 各軸の符号 (＋/−)
function signs(code: string): { O: string; C: string; E: string; A: string } {
  return { O: code[1], C: code[3], E: code[5], A: code[7] };
}

function CharCard({ id }: { id: ThirtyTwoTypeId }) {
  const base16 = id.slice(0, id.lastIndexOf("__")) as SixteenTypeId;
  const code = sixteenTypes[base16].code;
  const s = signs(code);
  const n = nAxisOf(id); // "N" | "R"
  const nLabel = n === "N" ? "繊細 (N高)" : "鉄壁 (N低)";
  const color = thirtyTwoColor(id);

  return (
    <div className="bg-white rounded-2xl border-2 border-[#3A2D6B]/10 p-3 flex flex-col">
      <div className="flex items-start gap-3">
        <Image
          src={thirtyTwoImagePath(id)}
          alt={thirtyTwoEssence(id)}
          width={88}
          height={88}
          className="w-[72px] h-[72px] rounded-xl bg-[#F4F1FB] flex-shrink-0 object-cover"
        />
        <div className="min-w-0">
          <span
            className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full text-[#3A2D6B] mb-1"
            style={{ background: color }}
          >
            {nLabel}
          </span>
          <p className="text-[#3A2D6B] font-black text-base leading-tight">
            {thirtyTwoEssence(id)}
          </p>
        </div>
      </div>

      <p className="text-[#3A2D6B]/75 text-xs leading-relaxed mt-2">
        {thirtyTwoOneLiner(id)}
      </p>

      <dl className="mt-2 pt-2 border-t border-[#3A2D6B]/10 text-[11px] text-[#3A2D6B]/70 space-y-0.5">
        <div className="flex gap-1">
          <dt className="font-bold text-[#3A2D6B]/50 w-[68px] flex-shrink-0">内部ID</dt>
          <dd className="font-mono break-all">{id}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold text-[#3A2D6B]/50 w-[68px] flex-shrink-0">Big Five</dt>
          <dd>
            O{s.O} C{s.C} E{s.E} A{s.A} ・ N{n === "N" ? "＋" : "−"}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold text-[#3A2D6B]/50 w-[68px] flex-shrink-0">群内位置</dt>
          <dd>
            C{s.C} × A{s.A}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold text-[#3A2D6B]/50 w-[68px] flex-shrink-0">画像</dt>
          <dd className="font-mono break-all">
            /characters/v3/{thirtyTwoImagePath(id).split("/").pop()}
          </dd>
        </div>
      </dl>
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
          <h1 className="text-[#3A2D6B] font-black text-2xl mb-3">
            32キャラ リファレンス
          </h1>
          <div className="bg-[#FFF4D6] border border-[#3A2D6B]/15 rounded-xl p-3 text-xs text-[#3A2D6B]/80 leading-relaxed mb-3">
            <b className="text-[#3A2D6B]">⚠ 内部IDの動物名と表示キャラの動物は一致しません。</b>
            <br />
            生息地優先マッピングのため意図的にこうしています。例:{" "}
            <code className="font-mono">quiet-owl__N</code>{" "}
            の表示は「きらめきインコ」。混乱しないよう、内部ID(ThirtyTwoTypeId)は
            参考情報として扱ってください。
          </div>
          <div className="text-xs text-[#3A2D6B]/75 leading-relaxed space-y-1">
            <p className="font-black text-[#3A2D6B]">グループ = base16 の E×O / N高=繊細(__N)・N低=鉄壁(__R)</p>
            <p>🕊 空 (緑 #A8D88A) = quiet-owl / seeker-wolf / dreamer-rabbit / fantasy-cat</p>
            <p>🌿 陸 (ピンク #F5A9C0) = caretaker-dog / brisk-tiger / smiley-panda / playful-raccoon</p>
            <p>🌊 海 (青 #8EC5E8) = sparkle-dolphin / ambition-lion / idea-monkey / whim-fox</p>
            <p>✨ 未知 (紫 #C3A0E0) = earnest-elephant / steady-turtle / gentle-koala / solo-hedgehog</p>
            <p className="text-[#3A2D6B]/55">
              ※ O/C/E/A の高低は sixteen-types.ts の code から。群内位置は C×A の組み合わせ。
            </p>
          </div>
        </header>

        {GROUPS.map((g) => (
          <section key={g.label} className="mb-8">
            <h2
              className="rounded-xl px-4 py-2 mb-3 text-[#3A2D6B] font-black text-lg flex items-center gap-2"
              style={{ background: g.color }}
            >
              <span>{g.emoji}</span>
              <span>{g.label}グループ</span>
              <span className="font-mono text-xs font-bold opacity-70">
                {g.color}
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
        ))}

        <footer className="text-center text-[#3A2D6B]/45 text-xs pb-8">
          全32キャラ ・ 内部資料 ・ 一般導線なし(直URLのみ)
        </footer>
      </div>
    </main>
  );
}
