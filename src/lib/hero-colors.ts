// 結果ページのヒーロー帯トーン (グループ別)。/me・/tako の ResultHero で共有。
//   heroBg   = 帯の背景色 (ミディアムトーン)。
//   codeTint = OCEAN コードの色 (帯背景より一段暗い脇役トーン)。
// 称号(名前)はブランド固定ネイビー/白で別管理。フラグoff(16タイプ)は unknown で解決。

import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";

const HERO_BAND: Record<ThirtyTwoGroup, string> = {
  sea: "#5BC6DB", // 海: ミディアムシアン
  sky: "#EDCF62", // 空: ミディアムイエロー
  land: "#8FCE70", // 陸: ミディアムグリーン
  unknown: "#B49BE8", // 未知: ミディアムラベンダー
};

const CODE_TINT: Record<ThirtyTwoGroup, string> = {
  sea: "#3D9DB1", // 帯 #5BC6DB の少し暗い版
  sky: "#C4A83F", // 帯 #EDCF62 の少し暗い版
  land: "#6DAA50", // 帯 #8FCE70 の少し暗い版
  unknown: "#9377CC", // 帯 #B49BE8 の少し暗い版
};

export function heroColorsForGroup(group: ThirtyTwoGroup): {
  heroBg: string;
  codeTint: string;
} {
  return { heroBg: HERO_BAND[group], codeTint: CODE_TINT[group] };
}
