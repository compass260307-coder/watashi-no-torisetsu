// 相互理解度ページの本文 (アドバイス/考察) 共通スタイル。
// ①「◯◯さんから見たアナタ」の本文が基準。②以降のセクション (③〜⑦含む) も
// 本文テキストはこれを参照し、二重定義しない。
//
// タイポグラフィは自己診断 /me の本文プローズと同一に統一する。
// /me 本体 (me/[token]/page.tsx) や /tako のみんなの目プローズ / aisho が
// 使っている既存の本文クラス文字列をそのまま流用 (body-gothic=角ゴシック / 濃色 /
// 400 / 17px / 行間1.4)。新規の数値は作らない。
export const PERCEPTION_BODY_TEXT_CLASS =
  "body-gothic text-[#1A1A1A] font-normal text-[17px] leading-[1.4]";
