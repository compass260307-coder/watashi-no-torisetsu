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

// 課金カード (FullAccessPromoCard) 用のグループ別トーン。
//   accent = アイコン/価格/バッジ星に使う濃いめ色 (白抜きに耐える濃さ)。
//   softBg = カード地の淡いティント。 border = 淡い枠線。 panelBg = 画像枠の地。
// ヒーロー帯 (medium) より淡くして、本文の可読性を保ちつつグループ色を纏わせる。
const CARD_TONE: Record<
  ThirtyTwoGroup,
  { accent: string; softBg: string; border: string; panelBg: string }
> = {
  sea: { accent: "#2F8DA1", softBg: "#EAF7FA", border: "#C5E7EE", panelBg: "#DFF2F6" },
  sky: { accent: "#B6982F", softBg: "#FBF6E4", border: "#EFE3B5", panelBg: "#F7EFD2" },
  land: { accent: "#5B9C41", softBg: "#EEF7E9", border: "#CDE8BF", panelBg: "#E2F1D9" },
  unknown: { accent: "#8B6FC6", softBg: "#F3EFFB", border: "#DDD0F2", panelBg: "#EBE3F8" },
};

export function cardColorsForGroup(group: ThirtyTwoGroup): {
  accent: string;
  softBg: string;
  border: string;
  panelBg: string;
} {
  return CARD_TONE[group];
}
