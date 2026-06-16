// ============================================================================
// 32 タイプ化 PoC (概念実証) — 加算レイヤー
// ============================================================================
// 目的: 16 タイプ (O/C/E/A の 4 軸) に N(神経症傾向) を 5 軸目として足し、
//       2^5 = 32 タイプが「既存 scores のまま導出できる」ことを実証する。
//
// 設計方針 (隔離・本番無改変):
//   - 本番の sixteen-types.ts / 各コンテンツファイル / 既存ページは一切変更しない。
//   - ここは「足すだけ」のレイヤー。32 → ベース 16 へフォールバックして仮表示する。
//   - N は既に diagnosis.ts で nModifier として判定され users.scores に保存済みなので、
//     既存ユーザーも scores.N から自動的に 32 判定へ乗る (本ファイルで実証)。
//
// ⚠️ PoC の仮実装ポイント (本実装で差し替える箇所):
//   - 32 のメタデータ (name/essence/oneLiner) は 16 を流用し N 印だけ付与。
//     本来は N高(繊細)/N低(鉄壁) で別の人物像コピーを用意する。
//   - キャラ画像は N 違いでも同じ 16 動物画像を流用。本来は N 差分ビジュアルを供給。
//   - 文章コンテンツ (self-result / perceived / manual) は base16 のものをそのまま使う。
// ============================================================================

import type { BigFiveDimension } from "./types";
import {
  type SixteenTypeId,
  sixteenTypes,
  classifySixteenType,
  characterImagePath,
  animalSlugForType,
} from "./sixteen-types";

// N 軸: diagnosis.ts の nModifier と同義 (N=繊細/高, R=鉄壁/低)。
export type NAxis = "N" | "R";

// 32 タイプ ID = 16 タイプ ID + "__" + N 軸。例: "sparkle-dolphin__N"
export type ThirtyTwoTypeId = `${SixteenTypeId}__${NAxis}`;

export interface ThirtyTwoType {
  id: ThirtyTwoTypeId;
  baseId: SixteenTypeId; // フォールバック先の 16 タイプ
  nAxis: NAxis;
  name: string; // PoC 仮: 16 名 + N 印
  animal: string;
  code: string; // 16 コード + N 印 (5 軸目)
  essence: string; // PoC 仮: 16 流用
  oneLiner: string; // PoC 仮: 16 流用
}

const SCALE_MIDPOINT = 5.0; // 判定しきい値 (diagnosis.ts / sixteen-types.ts と同値)

// N 軸ラベル (PoC 仮). 本実装ではここに N 別のニュアンス文を持たせる想定。
export const N_AXIS_LABEL: Record<NAxis, { tag: string; nuance: string }> = {
  N: { tag: "繊細", nuance: "感情のアンテナが敏感で、機微に気づくタイプ" },
  R: { tag: "鉄壁", nuance: "動じにくく、プレッシャー下でも安定するタイプ" },
};

const N_AXES: readonly NAxis[] = ["N", "R"];

/** scores.N の高低から N 軸を決める。欠損は中央値 5 (= R 境界) 扱い。 */
export function nAxisFromScore(n: number | undefined): NAxis {
  return (typeof n === "number" ? n : SCALE_MIDPOINT) >= SCALE_MIDPOINT
    ? "N"
    : "R";
}

/**
 * user.scores (Big Five 0-10) から 32 タイプを派生する。
 * ベース 16 (classifySixteenType: O/C/E/A) に N 軸を足すだけ。
 * → 既存スコアのまま、N 高/低 で別タイプに分岐する。
 */
export function classifyThirtyTwoType(
  scores: Partial<Record<BigFiveDimension, number>>,
): ThirtyTwoTypeId {
  const base = classifySixteenType(scores);
  const n = nAxisFromScore(scores.N);
  return `${base}__${n}`;
}

/** 32 タイプ ID → ベース 16 タイプ ID (コンテンツ・画像フォールバック用) */
export function baseIdOf(id: ThirtyTwoTypeId): SixteenTypeId {
  return id.slice(0, id.lastIndexOf("__")) as SixteenTypeId;
}

/** 32 タイプ ID → N 軸 */
export function nAxisOf(id: ThirtyTwoTypeId): NAxis {
  return id.slice(id.lastIndexOf("__") + 2) as NAxis;
}

// 32 メタデータを sixteenTypes から自動生成 (手書きしない)。
// ⚠️ PoC 仮: name に N 印を付けるだけ。essence/oneLiner は 16 流用。
export const thirtyTwoTypes: Record<ThirtyTwoTypeId, ThirtyTwoType> = (() => {
  const out = {} as Record<ThirtyTwoTypeId, ThirtyTwoType>;
  for (const baseId of Object.keys(sixteenTypes) as SixteenTypeId[]) {
    const base = sixteenTypes[baseId];
    for (const n of N_AXES) {
      const id = `${baseId}__${n}` as ThirtyTwoTypeId;
      const label = N_AXIS_LABEL[n];
      out[id] = {
        id,
        baseId,
        nAxis: n,
        name: `${base.name}・${label.tag}`, // PoC 仮表示
        animal: base.animal,
        code: `${base.code}N${n === "N" ? "＋" : "−"}`,
        essence: base.essence, // PoC 仮: 16 流用
        oneLiner: base.oneLiner, // PoC 仮: 16 流用
      };
    }
  }
  return out;
})();

/** 32 タイプのメタデータ取得 */
export function thirtyTwoType(id: ThirtyTwoTypeId): ThirtyTwoType {
  return thirtyTwoTypes[id];
}

/**
 * 32 タイプのキャラ画像パス。
 * ⚠️ PoC 仮: N 違いでも同じ 16 動物画像を流用 (characterImagePath(base))。
 *   本実装では N 差分ビジュアル、または既存の 32 カード画像
 *   (/public/cards/{fullCode}.png) を割り当てる。
 */
export function thirtyTwoCharacterImagePath(id: ThirtyTwoTypeId): string {
  return characterImagePath(baseIdOf(id));
}

/** 全 32 タイプ ID 配列 (図鑑・検証用) */
export function allThirtyTwoTypeIds(): ThirtyTwoTypeId[] {
  return Object.keys(thirtyTwoTypes) as ThirtyTwoTypeId[];
}

export { animalSlugForType };

// =====================================================================
// コンテンツ解決: 32 実データ優先 → 無ければ base16 フォールバック
// =====================================================================
// 32 実データ (繊細N/鉄壁R で書き分け) を最優先で返す。万一キーが欠けていれば
// base16 (本番16タイプの実コンテンツ) にフォールバックする。
// どのキーがフォールバックかは missingThirtyTwoContentKeys() で一覧できる。

import { selfResultContent32 } from "./thirty-two-content/self-result-32";
import { perceivedByType32 } from "./thirty-two-content/perceived-by-type-32";
import { manualByType32 } from "./thirty-two-content/manual-by-type-32";
import {
  perceivedManualContent32,
  PERCEIVED_TIPS_KEY32,
} from "./thirty-two-content/perceived-manual-32";
import {
  thirtyTwoCharacter,
  THIRTY_TWO_GROUP_COLOR,
  THIRTY_TWO_ASSET_VERSION,
  type ThirtyTwoGroup,
} from "./thirty-two-content/character-32";
import {
  selfResultContent,
  type SelfSection,
} from "./self-result-content";
import {
  getPerceivedContent,
  getOwnerManual,
  type PerceivedTypeContent,
  type ContentItem,
} from "./mutual-result-content";
import {
  perceivedManualContent,
  PERCEIVED_TIPS_KEY,
} from "./perception-manual-content";

/** ① 自己診断本文: 32 実データ → base16 フォールバック */
export function selfContentFor(id: ThirtyTwoTypeId): SelfSection[] {
  return selfResultContent32[id] ?? selfResultContent[baseIdOf(id)];
}

/** ③ 強み/あれっ?: 32 実データ → base16 フォールバック (base16 も無ければ null) */
export function perceivedContentFor(
  id: ThirtyTwoTypeId,
): PerceivedTypeContent | null {
  return perceivedByType32[id] ?? getPerceivedContent(baseIdOf(id));
}

/** ④ 付き合い方コツ: 32 実データ → base16 フォールバック (base16 も無ければ null) */
export function ownerManualFor(id: ThirtyTwoTypeId): ContentItem[] | null {
  return manualByType32[id] ?? getOwnerManual(baseIdOf(id));
}

/** ② 友達視点本文 (1本string・2段落): 32 実データ → base16 フォールバック */
export function perceivedManualFor(id: ThirtyTwoTypeId): string {
  return perceivedManualContent32[id] ?? perceivedManualContent[baseIdOf(id)];
}

/** ② vividPink 強調キーフレーズ: 32 実データ → base16 フォールバック */
export function perceivedTipsKeyFor(id: ThirtyTwoTypeId): string {
  return PERCEIVED_TIPS_KEY32[id] ?? PERCEIVED_TIPS_KEY[baseIdOf(id)];
}

// =====================================================================
// 解釈B: 32キャラの 名前 / essence / 画像(v3) / グループ色 (フラグ on 表示用)
// 表示パスは flag on のとき下記 resolver を使い、off は従来16 (sixteenTypes / v2)。
// =====================================================================

/** 32キャラの正式名 (例: きらめきインコ) */
export function thirtyTwoName(id: ThirtyTwoTypeId): string {
  return thirtyTwoCharacter[id].name;
}

/** 32キャラの essence (例: 太陽の社交家) */
export function thirtyTwoEssence(id: ThirtyTwoTypeId): string {
  return thirtyTwoCharacter[id].essence;
}

/** 32キャラの画像パス (/characters/v3/<slug>.png)。画像未配置でもパスだけ組める。 */
export function thirtyTwoImagePath(id: ThirtyTwoTypeId): string {
  return `/characters/v${THIRTY_TWO_ASSET_VERSION}/${thirtyTwoCharacter[id].slug}.png`;
}

/** 32キャラの生息地グループ */
export function thirtyTwoGroup(id: ThirtyTwoTypeId): ThirtyTwoGroup {
  return thirtyTwoCharacter[id].group;
}

/** 32キャラのグループ色 (例: 空=#A8D88A) */
export function thirtyTwoColor(id: ThirtyTwoTypeId): string {
  return THIRTY_TWO_GROUP_COLOR[thirtyTwoCharacter[id].group];
}

/**
 * 32 実データが欠けている (= base16 フォールバックになる) キーの一覧。
 * 全 32 キーが実データで埋まっていれば、各配列とも空になる。
 */
export function missingThirtyTwoContentKeys(): {
  self: ThirtyTwoTypeId[];
  perceived: ThirtyTwoTypeId[];
  manual: ThirtyTwoTypeId[];
  perceivedManual: ThirtyTwoTypeId[];
  tipsKey: ThirtyTwoTypeId[];
} {
  const all = allThirtyTwoTypeIds();
  return {
    self: all.filter((id) => !selfResultContent32[id]),
    perceived: all.filter((id) => !perceivedByType32[id]),
    manual: all.filter((id) => !manualByType32[id]),
    perceivedManual: all.filter((id) => !perceivedManualContent32[id]),
    tipsKey: all.filter((id) => !PERCEIVED_TIPS_KEY32[id]),
  };
}
