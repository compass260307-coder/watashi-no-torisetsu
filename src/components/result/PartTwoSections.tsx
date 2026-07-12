// 第二部「友達から見たアナタ」表示層 (三層モデル)。
//
// 構成 (2026-07-12 確定・ロック状態でも同じ並び):
//   1. 友達から見たアナタの武器      … 無料 (未解放でも本物を公開)
//   2. 友達から嫌われやすい性格      … 🔒 (未解放はぼかし + 解除カード)
//   3. 友達から好かれやすい性格      … 無料 (未解放でも本物を公開)
//   4. 関係別の見られ方 (友達/恋人/家族/上司) … 🔒 (未解放はぼかし + 小ボタン)
//   5. ギャップ予告カード (第三部 /tako への釣り) … 常時
//
// サーバコンポーネント。🔒ブロックの本文は未解放時サーバで解決すらされない
// (part-two-resolve.ts、フェイルクローズ)。ぼかしはダミーであり本物の目隠しではない。
// 解除カード (lockCard: 友達3人シェア/QR + ¥299) は /me がオーナー情報込みで組んで渡す。

import Link from "next/link";
import type { ResolvedPartTwo } from "@/lib/part-two-resolve";
import type { ContentItem } from "@/lib/mutual-result-content";

// 最初の🔒ブロックに重ねる解除カードの id (後続🔒ブロックの小ボタンのアンカー先)。
export const PART_TWO_LOCK_ID = "part2-lock";

interface PartTwoSectionsProps {
  data: ResolvedPartTwo;
  /** 未解放時に出す解除カード (友達3人 or ¥299)。解放済みなら不要。 */
  lockCard?: React.ReactNode;
  /** /tako/[token] への誘導リンク用。 */
  ownerToken: string;
  /** 現在の友達回答数 (ギャップ予告カードの残り人数表示に使う)。 */
  friendCount: number;
  /** 第三部 (/tako) が完成する人数 (friend-stairs.ts の STAIR_COMPLETE)。 */
  completeThreshold: number;
}

function SectionHeading({ title, hook }: { title: string; hook: string }) {
  return (
    <>
      <h3 className="mb-1 text-[20px] font-black text-[#2E2E5C]">{title}</h3>
      <p className="mb-3 text-[13px] font-bold text-[#2E2E5C]/60">{hook}</p>
    </>
  );
}

function CardGrid({ items }: { items: ContentItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((it) => (
        <div
          key={it.title}
          className="rounded-xl border border-[#D9DCF5] bg-[#F7F7FE] px-4 py-3.5"
        >
          <p className="mb-1 text-[15px] font-black text-[#2E2E5C]">
            {it.title}
          </p>
          <p className="body-gothic text-[14px] leading-[1.55] text-[#1A1A1A]">
            {it.body}
          </p>
        </div>
      ))}
    </div>
  );
}

function DummyCards({ rows }: { rows: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none grid select-none grid-cols-2 content-start gap-3 blur-[6px]"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[#D9DCF5] bg-[#F7F7FE] p-3"
        >
          <div className="mb-2 h-3 w-3/4 rounded-full bg-[#2E2E5C]/30" />
          <div className="mb-1.5 h-2 w-full rounded-full bg-[#2E2E5C]/15" />
          <div className="h-2 w-5/6 rounded-full bg-[#2E2E5C]/15" />
        </div>
      ))}
    </div>
  );
}

// 後続🔒ブロック用の小さな解除ボタン (最初の解除カードへスクロール)。
function SmallUnlockButton() {
  return (
    <a
      href={`#${PART_TWO_LOCK_ID}`}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#5B5BEF] px-5 py-2.5 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="4" y="10" width="16" height="11" rx="2.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
      ロックを解除
    </a>
  );
}

export function PartTwoSections({
  data,
  lockCard,
  ownerToken,
  friendCount,
  completeThreshold,
}: PartTwoSectionsProps) {
  const remaining = Math.max(0, completeThreshold - friendCount);

  return (
    <div>
      {/* 予測の注記: 第三部 (本物) との線引き */}
      <p className="mb-6 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/70">
        ここから先は、アナタの回答から予測した「見られ方」。
        本物の見られ方は、友達だけが知っている。
      </p>

      {/* ── 1. 武器 (無料・未解放でも公開) ── */}
      {data.weapons && (
        <div className="mb-10">
          <SectionHeading
            title="友達から見たアナタの武器"
            hook="気づいてないのはアナタだけ。6つ"
          />
          <CardGrid items={data.weapons} />
        </div>
      )}

      {/* ── 2. 嫌われやすい性格 (🔒) ── */}
      <div className="mb-10">
        <SectionHeading
          title="友達から嫌われやすい性格"
          hook="先に知っておけば、こわくない。6つ"
        />
        {data.dislikable ? (
          <CardGrid items={data.dislikable} />
        ) : (
          <div className="relative overflow-hidden rounded-2xl">
            <DummyCards rows={4} />
            {/* 最初の🔒ブロック: 解除カード本体 (友達3人 or ¥299) を重ねる */}
            <div id={PART_TWO_LOCK_ID} className="relative -mt-2 pt-2">
              {lockCard}
            </div>
          </div>
        )}
      </div>

      {/* ── 3. 好かれやすい性格 (無料・未解放でも公開) ── */}
      <div className="mb-10">
        <SectionHeading
          title="友達から好かれやすい性格"
          hook="アナタの5つの軸から。ぜんぶ本物"
        />
        <CardGrid items={data.likable} />
      </div>

      {/* ── 4. 関係別の見られ方 (🔒) ── */}
      <div className="mb-10">
        <SectionHeading
          title="関係別の見られ方"
          hook="友達・恋人・家族・上司から、それぞれどう見えてる?"
        />
        {data.relations ? (
          <div className="space-y-4">
            {data.relations.map((r) => (
              <div
                key={r.relation}
                className="rounded-xl border border-[#D9DCF5] bg-white px-4 py-4"
              >
                <p className="mb-1.5 inline-block rounded-full bg-[#2E2E5C] px-3 py-0.5 text-[12px] font-black text-white">
                  {r.relation}
                </p>
                <p className="body-gothic text-[15px] leading-[1.6] text-[#1A1A1A]">
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl">
            <DummyCards rows={4} />
            <div className="absolute inset-0 flex items-center justify-center">
              <SmallUnlockButton />
            </div>
          </div>
        )}
      </div>

      {/* ── 5. ギャップ予告 (第三部 /tako への釣り)。5人到達後は完成カードに変わる ── */}
      <div className="rounded-2xl border border-[#E3E6F5] bg-white px-5 py-6 text-center shadow-[0_8px_24px_rgba(46,46,92,0.10)]">
        {remaining > 0 ? (
          <>
            <p className="mb-2 text-[15px] font-black leading-relaxed text-[#2E2E5C]">
              {data.gapTeaser}
            </p>
            <p className="mb-4 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/70">
              本物の見られ方は、友達{completeThreshold}人で完成する。あと{remaining}人。
              お金では買えない。
            </p>
          </>
        ) : (
          <>
            <p className="mb-2 text-[17px] font-black leading-relaxed text-[#2E2E5C]">
              本物の見られ方が、完成してる。
            </p>
            <p className="mb-4 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/70">
              友達{completeThreshold}人の回答が集まった。
              一人ひとりの答え・自分とのズレ・手紙は、他己診断ページに。
            </p>
          </>
        )}
        <Link
          href={`/tako/${ownerToken}`}
          className="inline-flex items-center justify-center rounded-full bg-[#2E2E5C] px-6 py-3 text-[15px] font-black text-white shadow-[0_4px_0_#1b1b3e] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#1b1b3e]"
        >
          本物の見られ方を見にいく →
        </Link>
      </div>
    </div>
  );
}
