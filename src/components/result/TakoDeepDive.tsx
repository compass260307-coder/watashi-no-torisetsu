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
import { FriendList } from "./FriendList";
import { type DeepDiveData } from "@/lib/tako-deepdive";
import type { FriendSummary } from "@/lib/owner-report-data";

interface TakoDeepDiveProps {
  deep: DeepDiveData;
  /** 評価してくれた友達全員 (相互理解度順)。友達一覧→個別ページの導線に使う。 */
  friends: FriendSummary[];
  /** 個別ページ /tako/[token]/friend/[perceptionId] のリンク組み立て用。 */
  token: string;
  /** AI解説文取得用 (/api/minna-no-me/[ownerToken])。 */
  ownerToken: string;
}

export function TakoDeepDive({
  deep,
  friends,
  token,
  ownerToken,
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
      <MinnaNoMeProse ownerToken={ownerToken} />

      {/* 中: 友達一覧 (旧「友達からの声」の格上げ)。評価者全員をタップで個別ページへ。 */}
      <FriendList friends={friends} token={token} />
    </div>
  );
}
