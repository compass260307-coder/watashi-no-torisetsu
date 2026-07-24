// 友達診断 /tako 結果ページ ②恋愛の課金ブロック。
// 2026-07-24: 「隠れモテポイント/モテるためのヒント」を刷新し、
//   ・「アナタに沼る人」 (沼るポイント3つ + 沼る瞬間のシーンカード)
//   ・「損してるポイント」 (伝わってない魅力2つ + 取り返すヒント各1行)
// に置き換え (resolveNumaru / resolveLossPoints・friend-love-content.ts)。
// 旧 resolveFriendLoveChecklist / resolveMoteHints は完全版PDFレポート側で継続使用。

import type { ReactNode } from "react";
import type { LossItem, NumaruContent } from "@/lib/friend-love-content";

interface FriendLoveSectionProps {
  /** 「アナタに沼る人」(resolveNumaru)。 */
  numa: NumaruContent | null;
  /** 「損してるポイント」(resolveLossPoints・2項目)。 */
  loss: LossItem[];
  /** 「誰から見たか」の表示名 (例 "ゆかさん")。省略時は総称「友達」。 */
  viewer?: string;
  /**
   * tako 未購入時のロックブロック (TakoLockedBlock)。指定時は
   * 各ブロックの中身の代わりに表示する (見出しは残す)。
   * フェイルクローズ: ロック時は numa/loss に実データを渡さないこと。
   */
  lockedBlocks?: { numa: ReactNode; loss: ReactNode };
}

// 沼るポイント行 (ピンクのハート + 太字タイトル + 短文)。
function NumaRow({ item }: { item: { title: string; body: string } }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-2 text-[15px] font-black text-[#2E2E5C]">
        <span
          aria-hidden="true"
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#FF6B9D] text-[#FF6B9D]"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20.5s-6.2-4-8.6-7.6C1.7 10.4 2.4 7.1 5.1 5.8c1.9-.9 4.1-.4 5.5 1.1L12 8.3l1.4-1.4c1.4-1.5 3.6-2 5.5-1.1 2.7 1.3 3.4 4.6 1.7 7.1C18.2 16.5 12 20.5 12 20.5z" />
          </svg>
        </span>
        {item.title}
      </p>
      <p className="body-gothic pl-7 text-[14px] leading-[1.6] text-[#1A1A1A]">
        {item.body}
      </p>
    </div>
  );
}

// 損してるポイント行 (黄色の注意アイコン + 本文 + 緑チェックのヒント1行)。
function LossRow({ item }: { item: LossItem }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-2 text-[15px] font-black text-[#2E2E5C]">
        <span
          aria-hidden="true"
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[#F2C14E]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        {item.title}
      </p>
      <p className="body-gothic pl-7 text-[14px] leading-[1.6] text-[#1A1A1A]">
        {item.body}
      </p>
      <p className="body-gothic mt-1 flex items-start gap-2 pl-7 text-[14px] leading-[1.6] text-[#1A1A1A]">
        <span
          aria-hidden="true"
          className="mt-[3px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#4CAF7D] text-[#4CAF7D]"
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        {item.hint}
      </p>
    </div>
  );
}

export function FriendLoveSection({
  numa,
  loss,
  viewer,
  lockedBlocks,
}: FriendLoveSectionProps) {
  const who = viewer ?? "友達";
  if (!lockedBlocks && !numa && loss.length === 0) return null;
  return (
    <div>
      {/* アナタに沼る人 */}
      <h3 className="mb-5 text-[20px] font-black leading-snug text-[#2E2E5C] md:text-[22px]">
        {who}の回答でわかった、アナタに沼る人
      </h3>
      {lockedBlocks?.numa ??
        (numa && (
          <>
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              {numa.items.map((it) => (
                <NumaRow key={it.title} item={it} />
              ))}
            </div>
            {/* 沼る瞬間 (淡ピンクのシーンカード) */}
            <div className="mt-6 rounded-3xl bg-[#FFF0F5] px-6 py-6">
              <p className="mb-2 text-[13px] font-black tracking-wide text-[#FF6B9D]">
                沼る瞬間
              </p>
              <p className="body-gothic text-[15px] leading-[1.7] text-[#1A1A1A]">
                {numa.moment}
              </p>
            </div>
          </>
        ))}

      {/* 損してるポイント */}
      {(lockedBlocks || loss.length > 0) && (
        <div className="mt-10">
          <h3 className="mb-5 text-[20px] font-black leading-snug text-[#2E2E5C] md:text-[22px]">
            {who}にまだ伝わってない、損してるポイント
          </h3>
          {lockedBlocks?.loss ?? (
            <div className="flex flex-col gap-6">
              {loss.map((it) => (
                <LossRow key={it.title} item={it} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
