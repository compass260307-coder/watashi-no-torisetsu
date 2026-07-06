// キャラ画像のヒーロー表示ヘルパー。
// v3 原画の地色は結果ページのヒーロー帯色と微妙にズレて四角い縁が見えるため、
// 背景除去済みの透過版 (/characters/cut) があればそちらを優先し、帯に完全に馴染ませる。
// 透過版が無いタイプのみ v3 原画にフォールバック。/me・/tako の両ヒーローで共有し、
// 自己/友達どちらのキャラも同一の透過アセットを参照するよう統一する。

import characterImages from "@/generated/character-images.json";

/** v3 原画パスを受け取り、透過版があれば /characters/cut のパスを、無ければ引数のまま返す。 */
export function preferCutImage(v3Path: string): string {
  const base = v3Path.slice(v3Path.lastIndexOf("/") + 1);
  return (characterImages.cut as string[]).includes(base)
    ? `/characters/cut/${base}`
    : v3Path;
}
