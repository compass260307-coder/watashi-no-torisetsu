// 日本語・友達0人の招待カードの上半分 (見出し「友達から見たあなたは？」・見本リンク・フェルトの絵)。
// 友達診断ページ (TakoFriendTabs) と、自己診断結果ページの招待カード (ResultInviteCard) で
// 同じ見た目を使うために切り出したもの。
//
// 左寄せ。見出しの右の空きいっぱいにイラストを出す。文字の行は折り返さず、
// イラストが残りの幅に合わせて伸縮する (上限 160px / sm 以上 180px)。

import Image from "next/image";
import Link from "next/link";
import friendsWaiting from "../../../public/empty-states/tako-friends-waiting-felt.png";

export function TakoEmptyInviteHeader({
  titleId,
  demoHref,
}: {
  /** ダイアログの aria-labelledby に渡す見出しの id。 */
  titleId: string;
  /** 「結果の見本を見る」の行き先。省略時はリンクを出さない。 */
  demoHref?: string;
}) {
  return (
    <div className="text-left">
      {/* 見出しと見本リンクを1列にまとめ、イラストと上下中央でそろえる (カード上部を詰めるため) */}
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <h2
            id={titleId}
            className="whitespace-nowrap text-[clamp(22px,7vw,26px)] font-black leading-[1.3] text-[#2E2E5C] md:text-[28px]"
          >
            友達から見た
            <br className="sm:hidden" />
            あなたは？
          </h2>
          {demoHref ? (
            <Link
              href={demoHref}
              className="-ml-2 mt-1 inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[13px] font-black text-[#5B5BEF] hover:bg-[#F4F4FF]"
            >
              結果の見本を見る
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m8 5 5 5-5 5" />
              </svg>
            </Link>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 justify-end">
          <Image
            src={friendsWaiting}
            alt=""
            aria-hidden="true"
            width={1402}
            height={1122}
            sizes="(min-width: 640px) 180px, 40vw"
            className="h-auto w-full max-w-[160px] select-none sm:max-w-[180px]"
          />
        </div>
      </div>
    </div>
  );
}
