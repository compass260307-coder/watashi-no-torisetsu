// Day 12 ③④改修: ③「◯◯さんが見つけたアナタ」の文章カード。
//
// 旧バッジ/吹き出し UI (PerceptionFoundYou) を撤去し、①④と同じ質感の文章カードに
// 全面改装したもの。リズムは「前半=見る、後半=読む」。
// 各項目 = 独立した段落 (強み3段落 / あれっ?3段落)。vividPink 太字は段落先頭の
// ワードのみで、本文は deepPurple 太字の一色 (① と同じ)。段落は
// perception-found-text.ts の weaveFound が生成したセグメント列を描画するだけ
// (Server Component)。友達名は小見出しにのみ表示 (フル表示・切り捨てなし)。

import { PERCEPTION_BODY_TEXT_CLASS } from "./body-text";
import type { FoundParagraph } from "@/lib/perception-found-text";

export function PerceptionFoundProse({
  perceiverName,
  strengthParas,
  surpriseParas,
  // 小見出しを明示指定 (評価者視点ページ用)。未指定なら「◯◯さん認定の強み」等。
  strengthLabel,
  surpriseLabel,
}: {
  perceiverName: string;
  strengthParas: FoundParagraph[];
  surpriseParas: FoundParagraph[];
  strengthLabel?: string;
  surpriseLabel?: string;
}) {
  return (
    <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
      {/* 強みパート */}
      <p className="text-[#5B5BEF] font-bold text-sm mb-3 text-center">
        {strengthLabel ?? `${perceiverName}さん認定の強み`}
      </p>
      {strengthParas.map((para, i) => (
        <ProseParagraph key={i} para={para} />
      ))}

      {/* 薄い区切り (①②のカード内区切りと同じ) */}
      <div className="border-t border-[#2E2E5C]/10 my-5" />

      {/* あれっ?パート */}
      <p className="text-[#5B5BEF] font-bold text-sm mb-3 text-center">
        {surpriseLabel ?? `${perceiverName}さんの「あれっ?」`}
      </p>
      {surpriseParas.map((para, i) => (
        <ProseParagraph key={i} para={para} />
      ))}
    </div>
  );
}

function ProseParagraph({ para }: { para: FoundParagraph }) {
  return (
    <p className={`${PERCEPTION_BODY_TEXT_CLASS} mb-4 last:mb-0`}>
      {para.map((seg, i) =>
        seg.pink ? (
          <strong key={i} className="text-[#5B5BEF] font-black">
            {seg.text}
          </strong>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}
