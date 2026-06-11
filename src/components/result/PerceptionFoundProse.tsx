// Day 12 ③④改修: ③「◯◯さんが見つけたアナタ」の文章カード。
//
// 旧バッジ/吹き出し UI (PerceptionFoundYou) を撤去し、①④と同じ質感の文章カードに
// 全面改装したもの。リズムは「前半=見る、後半=読む」。
// 強み/あれっ? のキーワードは vividPink 太字で文中に埋め込み、流し読みでも
// ワードが拾える視覚アンカーにする。段落は perception-found-text.ts の
// weaveFound が生成したセグメント列を受け取って描画するだけ (Server Component)。
// 友達名は小見出しにのみ表示 (フル表示・切り捨てなし)。

import { PERCEPTION_BODY_TEXT_CLASS } from "./body-text";
import type { FoundParagraph } from "@/lib/perception-found-text";

export function PerceptionFoundProse({
  perceiverName,
  strengthParas,
  surpriseParas,
}: {
  perceiverName: string;
  strengthParas: FoundParagraph[];
  surpriseParas: FoundParagraph[];
}) {
  return (
    <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
      {/* 強みパート */}
      <p className="text-[#FE3C72] font-bold text-sm mb-3 text-center">
        {perceiverName}さん認定の強み
      </p>
      {strengthParas.map((para, i) => (
        <ProseParagraph key={i} para={para} />
      ))}

      {/* 薄い区切り (①②のカード内区切りと同じ) */}
      <div className="border-t border-[#3A2D6B]/10 my-5" />

      {/* あれっ?パート */}
      <p className="text-[#FE3C72] font-bold text-sm mb-3 text-center">
        {perceiverName}さんの「あれっ?」
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
          <strong key={i} className="text-[#FE3C72] font-black">
            {seg.text}
          </strong>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}
