// タコ結果ページ ② アナタの深掘り。/me の世界観 (丸数字見出し・M PLUS Rounded・
//   ネイビー #2E2E5C / アクセント #5B5BEF / 淡ラベンダー #F4F4FE) にそろえた縦積み。
//
// "声の大きさ" で格付けし、線ではなく余白で塊を分ける:
//   大 = ギャップ (背景色カード・最大文字・数値だけアクセント色) ← 唯一の見せ場
//   中 = 友達からの声 (白カード・実物感・記名)
//   小 = 隠れた長所 (最下・控えめグレー)
// AI解説長文 (MinnaNoMeProse) は据え置きで、ギャップと友達の声のあいだに置く。
// ※ 一致度行・ギャップ小ラベル・AI解説見出しの3文言は撤去 (中身は保持)。

import { MinnaNoMeProse } from "./MinnaNoMeProse";
import {
  hiddenStrengthSentence,
  type DeepDiveData,
} from "@/lib/tako-deepdive";

interface TakoDeepDiveProps {
  deep: DeepDiveData;
  /** 友達からのメッセージ (記名・空は除外済み)。0件ならブロック非表示。 */
  letters: { name: string; message: string }[];
  /** AI解説文取得用 (/api/minna-no-me/[ownerToken])。 */
  ownerToken: string;
  /** dev/プレビュー限定: 解説長文の done 表示を確認するためのダミー本文。 */
  previewProse?: string;
}

export function TakoDeepDive({
  deep,
  letters,
  ownerToken,
  previewProse,
}: TakoDeepDiveProps) {
  const gap = deep.gap;
  return (
    <div className="flex flex-col gap-10">
      {/* 大: ギャップ (唯一の見せ場。背景色カード・最大文字・数値だけアクセント色)。
          小ラベルは撤去し、本文「一番のギャップは〜」だけで見せる。 */}
      <div className="rounded-3xl bg-[#F4F4FE] px-6 py-7">
        <p className="text-[#2E2E5C] font-black text-[22px] leading-[1.35] md:text-[26px]">
          一番のギャップは{gap.label}。自分では
          <span className="text-[#5B5BEF]">
            {gap.selfPercent <= 10 ? "ほぼゼロ" : `${gap.selfPercent}%`}
          </span>
          、でも友達は
          <span className="text-[#5B5BEF]">{gap.otherPercent}%</span>
          感じてる。
        </p>
      </div>

      {/* AI解説長文 (据え置き) */}
      <MinnaNoMeProse ownerToken={ownerToken} previewText={previewProse} />

      {/* 中: 友達からの声 (実物感の白カード・記名)。0件は非表示。 */}
      {letters.length > 0 && (
        <section>
          <h3 className="text-[#2E2E5C] font-black text-base mb-3">
            友達からの声
          </h3>
          <ul className="flex flex-col gap-3">
            {letters.map((l, i) => (
              <li
                key={`${l.name}-${i}`}
                className="rounded-2xl bg-white border-2 border-[#0094D8]/15 px-4 py-3"
              >
                <p className="body-gothic text-[#1A1A1A] font-normal text-[16px] leading-[1.4] whitespace-pre-wrap break-words">
                  {l.message}
                </p>
                <p className="text-[#2E2E5C]/60 text-xs font-bold mt-2 text-right">
                  — {l.name}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 小: 隠れた長所 (最下・控えめグレー。主役を邪魔しない) */}
      {deep.hiddenStrength && (
        <p className="text-[#2E2E5C]/55 font-bold text-sm leading-[1.5]">
          <span aria-hidden="true">🌱 </span>
          {hiddenStrengthSentence(deep.hiddenStrength)}
        </p>
      )}
    </div>
  );
}
