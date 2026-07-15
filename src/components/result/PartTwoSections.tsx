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
// 解除カード (lockCard: 完全版) は /me が組んで渡す。

import type { ResolvedPartTwo, RelationView } from "@/lib/part-two-resolve";
import type { ContentItem } from "@/lib/mutual-result-content";
import { PaywallScrollButton } from "@/components/result/PaywallScrollButton";

// 最初の🔒ブロックに重ねる解除カードの id (後続🔒ブロックの解除ボタンのアンカー先)。
export const PART_TWO_LOCK_ID = "part2-lock";

interface PartTwoSectionsProps {
  data: ResolvedPartTwo;
  /** 未解放時に出す完全版の解除カード。解放済みなら不要。 */
  lockCard?: React.ReactNode;
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h3 className="mb-3 text-[20px] font-black text-[#2E2E5C]">{title}</h3>
  );
}

// 16P「あなたの強み」風のチェックリスト (緑の丸チェック + 太字タイトル + 説明文、枠なし)。
function CheckList({ items }: { items: ContentItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
      {items.map((it) => (
        <div key={it.title}>
          <p className="mb-1 flex items-center gap-2 text-[15px] font-black text-[#2E2E5C]">
            <span
              aria-hidden="true"
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#4CAF7D] text-[#4CAF7D]"
            >
              <svg
                width="11"
                height="11"
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
            {it.title}
          </p>
          <p className="body-gothic pl-7 text-[14px] leading-[1.6] text-[#1A1A1A]">
            {it.body}
          </p>
        </div>
      ))}
    </div>
  );
}

// 武器の CheckList と同じ組版 (枠なし2カラム) で、アイコンだけ黄色の注意マークにした
// リスト (嫌われやすい性格用。2026-07-15 指示でカード枠 → チェックリスト風に統一)。
function WarnList({ items }: { items: ContentItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
      {items.map((it) => (
        <div key={it.title}>
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
            {it.title}
          </p>
          <p className="body-gothic pl-7 text-[14px] leading-[1.6] text-[#1A1A1A]">
            {it.body}
          </p>
        </div>
      ))}
    </div>
  );
}

// ぼかしの背後に敷くデコイ本文。「見えそうで見えない」もどかしさを作るため、
// 骨組みバーではなく本物と同じ組版の日本語テキストをぼかす。
// ⚠ これはダミー (全ユーザー共通のデコイ)。本物の本文はサーバで解決すらしていないので、
//   ぼかしを外されても漏れるのはこの文だけ (フェイルクローズは維持)。
const DECOY_ITEMS: ContentItem[] = [
  { title: "実は頑固なところ", body: "友達には、一度こうと決めたら曲げないアナタが、たまに見えている。" },
  { title: "連絡が遅くなりがち", body: "友達は、返事を後回しにするアナタに、少しだけやきもきしている。" },
  { title: "本音を出さない瞬間", body: "友達には、笑って流しているけど本音が見えない時がある、と映っている。" },
  { title: "気分にムラがある", body: "友達は、日によってテンションが違うアナタに気づいている。" },
  { title: "抱え込みやすい", body: "友達には、限界まで一人で頑張ってしまうアナタが心配に見えている。" },
  { title: "詰めが甘い時", body: "友達は、最後の最後で力が抜けるアナタを知っている。" },
  { title: "距離の取り方", body: "友達には、急に壁を作るように見える瞬間がある、と映っている。" },
  { title: "頼るのが苦手", body: "友達は、助けを求めないアナタに「言ってよ」と思っている。" },
  { title: "こだわりが強い", body: "友達には、細かい部分を譲らないアナタが見えている。" },
  { title: "熱しやすく冷めやすい", body: "友達は、夢中になる速さと飽きる速さの両方を知っている。" },
  { title: "空気を読みすぎる", body: "友達には、周りに合わせて疲れているアナタが見えている。" },
  { title: "負けず嫌いな一面", body: "友達は、さりげなく張り合ってくるアナタを面白がっている。" },
];

function DummyCards({ rows }: { rows: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none grid select-none grid-cols-2 content-start gap-3 blur-[4px]"
    >
      {/* rows がデコイ数を超えたら循環して埋める (ぼかし面を必要なだけ長く敷ける) */}
      {Array.from({ length: rows }, (_, i) => {
        const it = DECOY_ITEMS[i % DECOY_ITEMS.length];
        return (
          <div
            key={i}
            className="rounded-xl border border-[#D9DCF5] bg-[#F7F7FE] px-4 py-3.5 opacity-80"
          >
            <p className="mb-1 text-[15px] font-black text-[#2E2E5C]">
              {it.title}
            </p>
            <p className="body-gothic text-[14px] leading-[1.55] text-[#1A1A1A]">
              {it.body}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// 関係別の見られ方・解放時 (2026-07-15 指示):
// 武器の CheckList と同じ組版 (枠なし2カラム) で、アイコンは「言えずにいること」に
// 合わせた吹き出しマーク。色はロック画面の円と同じ関係別カラーで塗り分ける。
function RelationList({ relations }: { relations: RelationView[] }) {
  const colorOf = (relation: string) =>
    RELATION_LOCK_ITEMS.find((it) => it.label === relation)?.color ??
    "#2E2E5C";
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
      {relations.map((r) => (
        <div key={r.relation}>
          <p className="mb-1 flex items-center gap-2 text-[15px] font-black text-[#2E2E5C]">
            <span
              aria-hidden="true"
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center"
              style={{ color: colorOf(r.relation) }}
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
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </span>
            {r.relation}
          </p>
          <p className="body-gothic pl-7 text-[14px] leading-[1.6] text-[#1A1A1A]">
            {r.body}
          </p>
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
// 色は 2026-07-13 指定: 友達=水色 / 恋人=ピンク / 家族=緑 / 上司=黄色。
const RELATION_LOCK_ITEMS: { label: string; color: string }[] = [
  { label: "友達から", color: "#56BFE8" },
  { label: "恋人から", color: "#F48BAE" },
  { label: "家族から", color: "#4CAF7D" },
  { label: "上司・先輩から", color: "#F2C14E" },
  { label: "後輩から", color: "#9B8CF2" },
  { label: "初対面の人から", color: "#F28C5B" },
];

function RelationsLocked() {
  return (
    <div className="rounded-2xl bg-white px-4 py-8 shadow-[0_2px_12px_rgba(46,46,92,0.06)] md:px-10 md:py-10">
      {/* 鍵付きの円 (SP 2列 / md 3列。2026-07-15 に 4関係 → 6関係へ増量) */}
      <div className="mb-8 grid grid-cols-2 gap-x-2 gap-y-6 md:grid-cols-3">
        {RELATION_LOCK_ITEMS.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-2.5">
            <span
              className="flex h-[108px] w-[108px] items-center justify-center rounded-full border-4 bg-white text-[#B9BCCF]"
              style={{ borderColor: item.color }}
            >
              <LockGlyph size={30} />
            </span>
            <span className="text-[13px] font-black text-[#2E2E5C]">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* 解除カード (上辺にアクセント線 + 鍵バッジ)。PC は 16P の比率に合わせ広め */}
      <div className="relative mx-auto max-w-[480px] rounded-xl border border-[#E3E6F5] border-t-[3px] border-t-[#5B5BEF] px-5 pb-6 pt-7 text-center md:max-w-[640px]">
        <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white">
          <LockGlyph size={14} />
        </span>
        <p className="mb-1.5 text-[19px] font-black text-[#2E2E5C]">
          今すぐロックを解除
        </p>
        <p className="mb-4 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/65">
          完全版のレポートを入手して、
          <br className="md:hidden" />
          周りの人がアナタに言えずにいることを知りましょう。
        </p>
        {/* 最下部の課金カードへスムーススクロール+パルス。 */}
        <PaywallScrollButton
          source="relations_card"
          className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-6 py-3 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
        >
          今すぐアクセス
        </PaywallScrollButton>
      </div>
    </div>
  );
}

export function PartTwoSections({ data, lockCard }: PartTwoSectionsProps) {
  return (
    <div>
      {/* ブロック順は 好かれやすい → 嫌われやすい → 武器 → 関係別 (2026-07-14 指示)。 */}
      {/* ── 1. 好かれやすい性格 (無料・未解放でも公開)。カードではなく文章 (段落) ── */}
      <div className="mb-10">
        <SectionHeading title="好かれやすい性格" />
        <div className="px-1">
          {data.likable.map((para, i) => (
            <p
              key={i}
              className="body-gothic mb-4 text-[17px] font-normal leading-[1.4] text-[#1A1A1A] last:mb-0"
            >
              {para}
            </p>
          ))}
        </div>
      </div>

      {/* ── 2. 嫌われやすい性格 (🔒) ── */}
      <div className="mb-10">
        <SectionHeading title="嫌われやすい性格" />
        {data.dislikable ? (
          <WarnList items={data.dislikable} />
        ) : (
          /* 恋愛ロックと同じ構図: ぼかしダミーを高さの土台にし、
             その中央へコンパクトな解除カードを重ねる。 */
          <div className="relative overflow-hidden rounded-2xl">
            <div aria-hidden="true">
              <DummyCards rows={8} />
            </div>
            {/* 完全版の解除カード。後続🔒ブロックのアンカー先。 */}
            <div
              id={PART_TWO_LOCK_ID}
              className="absolute inset-0 flex items-center justify-center p-3"
            >
              {lockCard}
            </div>
          </div>
        )}
      </div>

      {/* ── 3. 武器 (無料・未解放でも公開)。16P「あなたの強み」風チェックリスト ── */}
      {data.weapons && (
        <div className="mb-10">
          <SectionHeading title="羨ましいあなたの武器" />
          <CheckList items={data.weapons} />
        </div>
      )}

      {/* ── 4. 関係別の見られ方 (🔒) ── */}
      <div className="mb-10">
        <SectionHeading title="周りの人が、あなたに言えずにいること" />
        {data.relations ? (
          <RelationList relations={data.relations} />
        ) : (
          <RelationsLocked />
        )}
      </div>
    </div>
  );
}
