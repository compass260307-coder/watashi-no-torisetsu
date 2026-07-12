// 第二部「友達から見たアナタ (予測)」表示層 (三層モデル Step2)。
//
// サーバコンポーネント (タブ等の状態なし)。本文は /me がサーバで resolvePartTwo() により
// 解決して props で渡す (未解放時はこのコンポーネント自体を描画しない)。
// 中身は自己タイプから導出した"予測"であり、実際の友達回答 (第三部 /tako) ではない。
// 冒頭の注記とギャップ予告で、その線引きと第三部への期待を明示する。

import Link from "next/link";
import type { ResolvedPartTwo } from "@/lib/part-two-resolve";
import type { ContentItem } from "@/lib/mutual-result-content";

interface PartTwoSectionsProps {
  data: ResolvedPartTwo;
  /** /tako/[token] への誘導リンク用。 */
  ownerToken: string;
  /** 現在の友達回答数 (ギャップ予告カードの残り人数表示に使う)。 */
  friendCount: number;
  /** 第三部 (/tako) が完成する人数 (friend-stairs.ts の STAIR_COMPLETE)。 */
  completeThreshold: number;
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

export function PartTwoSections({
  data,
  ownerToken,
  friendCount,
  completeThreshold,
}: PartTwoSectionsProps) {
  if (data.locked) return null;
  const remaining = Math.max(0, completeThreshold - friendCount);

  return (
    <div>
      {/* 予測の注記: 第三部 (本物) との線引きをはっきりさせる */}
      <p className="mb-6 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/70">
        ここから先は、アナタの回答から予測した「見られ方」。
        本物の見られ方は、友達だけが知っている。
      </p>

      {/* ── 第一印象 ── */}
      {data.firstImpression && (
        <div className="mb-10">
          <h3 className="mb-3 text-[20px] font-black text-[#2E2E5C]">
            アナタの第一印象
          </h3>
          {data.firstImpression.map((para, i) => (
            <p
              key={i}
              className="body-gothic mb-4 text-[17px] font-normal leading-[1.4] text-[#1A1A1A] last:mb-0"
            >
              {para}
            </p>
          ))}
        </div>
      )}

      {/* ── 強み ── */}
      {data.strengths && (
        <div className="mb-10">
          <h3 className="mb-3 text-[20px] font-black text-[#2E2E5C]">
            友達から見たアナタの強み
          </h3>
          <CardGrid items={data.strengths} />
        </div>
      )}

      {/* ── あれっ?な一面 (弱みの愛されるクセ変換) ── */}
      {data.surprises && (
        <div className="mb-10">
          <h3 className="mb-3 text-[20px] font-black text-[#2E2E5C]">
            友達だけが知ってる、あれっ?な一面
          </h3>
          <CardGrid items={data.surprises} />
        </div>
      )}

      {/* ── 友達から見た4つのステータス (対人特性 × 高/中/低) ── */}
      {data.stats && (
        <div className="mb-10">
          <h3 className="mb-3 text-[20px] font-black text-[#2E2E5C]">
            友達から見た4つのステータス
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-[#D9DCF5] bg-white px-4 py-3.5"
                style={{ borderLeft: `6px solid ${s.color}` }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[15px] font-black text-[#2E2E5C]">
                    {s.label}
                  </p>
                  <span className="rounded-full bg-[#F4F4FE] px-2.5 py-0.5 text-[12px] font-black text-[#2E2E5C]">
                    {s.level}
                  </span>
                </div>
                <p className="body-gothic text-[14px] leading-[1.55] text-[#1A1A1A]">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── アナタの取扱い方 (接し方のコツ) ── */}
      {data.manual && (
        <div className="mb-10">
          <h3 className="mb-3 text-[20px] font-black text-[#2E2E5C]">
            アナタの取扱い方
          </h3>
          {data.manual.map((para, i) => (
            <p
              key={i}
              className="body-gothic mb-4 text-[17px] font-normal leading-[1.4] text-[#1A1A1A] last:mb-0"
            >
              {para}
            </p>
          ))}
        </div>
      )}

      {/* ── ギャップ予告 (第三部 /tako への釣り)。5人到達後は完成カードに変わる ── */}
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
