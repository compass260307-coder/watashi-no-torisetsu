// 第二部「友達から見たアナタ」表示層 (三層モデル)。
//
// 構成 (2026-07-12 確定・ロック状態でも同じ並び):
//   1. 友達から見たアナタの武器      … 無料 (未解放でも本物を公開)
//   2. 友達から嫌われやすい性格      … 🔒 (未解放はぼかし + 解除カード)
//   3. 友達から好かれやすい性格      … 無料 (未解放でも本物を公開)
//   4. 関係別の見られ方 (友達/恋人/家族/上司) … 🔒 (未解放は 16P 風の鍵付き円 + 解除カード)
//
// 見出しはタイトルのみ (サブタイトル/前置きの注記は 2026-07-12 指示で削除)。
// ギャップ予告カード (/tako 誘導) も同日「一旦削除」(素材は part-two-resolve の gapTeaser に温存)。
//
// サーバコンポーネント。🔒ブロックの本文は未解放時サーバで解決すらされない
// (part-two-resolve.ts、フェイルクローズ)。ぼかしはダミーであり本物の目隠しではない。
// 解除カード (lockCard: 友達3人シェア/QR + ¥299) は /me がオーナー情報込みで組んで渡す。

import type { ResolvedPartTwo } from "@/lib/part-two-resolve";
import type { ContentItem } from "@/lib/mutual-result-content";

// 最初の🔒ブロックに重ねる解除カードの id (後続🔒ブロックの解除ボタンのアンカー先)。
export const PART_TWO_LOCK_ID = "part2-lock";

interface PartTwoSectionsProps {
  data: ResolvedPartTwo;
  /** 未解放時に出す解除カード (友達3人 or ¥299)。解放済みなら不要。 */
  lockCard?: React.ReactNode;
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h3 className="mb-3 text-[20px] font-black text-[#2E2E5C]">{title}</h3>
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

function LockGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

// 関係別の見られ方・未解放時 (16P「影響力のある特性」参考):
// 色付きリングの円に鍵アイコン + 関係ラベルを4つ並べ、下に「今すぐロックを解除」カード。
const RELATION_LOCK_ITEMS: { label: string; color: string }[] = [
  { label: "友達から", color: "#4A90D9" },
  { label: "恋人から", color: "#E0B040" },
  { label: "家族から", color: "#4CAF7D" },
  { label: "上司・先輩から", color: "#9B6BD1" },
];

function RelationsLocked() {
  return (
    <div className="rounded-2xl bg-white px-4 py-8 shadow-[0_2px_12px_rgba(46,46,92,0.06)] md:px-8">
      {/* 鍵付きの円 (SP 2列 / md 4列) */}
      <div className="mb-6 grid grid-cols-2 gap-x-2 gap-y-6 md:grid-cols-4">
        {RELATION_LOCK_ITEMS.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-2.5">
            <span
              className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] bg-white text-[#B9BCCF]"
              style={{ borderColor: item.color }}
            >
              <LockGlyph size={22} />
            </span>
            <span className="text-[13px] font-black text-[#2E2E5C]">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* 解除カード (上辺にアクセント線 + 鍵バッジ) */}
      <div className="relative mx-auto max-w-[480px] rounded-xl border border-[#E3E6F5] border-t-[3px] border-t-[#5B5BEF] px-5 pb-6 pt-7 text-center">
        <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white">
          <LockGlyph size={14} />
        </span>
        <p className="mb-1.5 text-[16px] font-black text-[#2E2E5C]">
          今すぐロックを解除
        </p>
        <p className="mb-4 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/65">
          友達・恋人・家族・上司から、
          <br className="md:hidden" />
          それぞれどう見えているかが分かります。
        </p>
        <a
          href={`#${PART_TWO_LOCK_ID}`}
          className="inline-flex items-center justify-center rounded-full bg-[#5B5BEF] px-6 py-2.5 text-[14px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
        >
          解除方法を見る
        </a>
      </div>
    </div>
  );
}

export function PartTwoSections({ data, lockCard }: PartTwoSectionsProps) {
  return (
    <div>
      {/* ── 1. 武器 (無料・未解放でも公開) ── */}
      {data.weapons && (
        <div className="mb-10">
          <SectionHeading title="友達から見たアナタの武器" />
          <CardGrid items={data.weapons} />
        </div>
      )}

      {/* ── 2. 嫌われやすい性格 (🔒) ── */}
      <div className="mb-10">
        <SectionHeading title="友達から嫌われやすい性格" />
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
        <SectionHeading title="友達から好かれやすい性格" />
        <CardGrid items={data.likable} />
      </div>

      {/* ── 4. 関係別の見られ方 (🔒) ── */}
      <div className="mb-10">
        <SectionHeading title="関係別の見られ方" />
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
          <RelationsLocked />
        )}
      </div>
    </div>
  );
}
