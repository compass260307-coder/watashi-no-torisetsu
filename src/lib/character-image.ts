// キャラ画像のヒーロー表示ヘルパー。
// v3 原画の地色は結果ページのヒーロー帯色と微妙にズレて四角い縁が見えるため、
// 背景除去済みの透過版 (/characters/cut) があればそちらを優先し、帯に完全に馴染ませる。
// 透過版が無いタイプのみ v3 原画にフォールバック。/me・/tako の両ヒーローで共有し、
// 自己/友達どちらのキャラも同一の透過アセットを参照するよう統一する。

import characterImages from "@/generated/character-images.json";
import type { ThirtyTwoGroup } from "./thirty-two-content/character-32";

/** v3 原画パスを受け取り、透過版があれば /characters/cut のパスを、無ければ引数のまま返す。 */
export function preferCutImage(v3Path: string): string {
  const base = v3Path.slice(v3Path.lastIndexOf("/") + 1);
  return (characterImages.cut as string[]).includes(base)
    ? `/characters/cut/${base}`
    : v3Path;
}

/**
 * グループ別のシーン挿絵 (public/characters/scenes/<group>_<variant>.png) の URL を返す。
 * アセットが無ければ null (= 非表示)。/me ページの sceneImage と同じ characterImages.scenes
 * インデックスを参照する共有版 (個別ページ /tako 個別 でも使えるよう切り出し)。
 * variant 例: normal1 / normal2 / love / work / school。
 */
export function sceneImageForGroup(
  group: ThirtyTwoGroup,
  variant: string,
): string | null {
  const name = `${group}_${variant}.png`;
  return (characterImages.scenes as string[]).includes(name)
    ? `/characters/scenes/${name}`
    : null;
}
