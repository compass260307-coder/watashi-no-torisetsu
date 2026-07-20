// 友達診断 完全版レポート (PDF) 用の、友達1人ぶんの章データを純データで組み立てる。
// /tako/[token] の friendSheets 派生ロジックと同じ素材 (32タイプ本文・恋愛・モテ・
// 相性推定) を、JSX ではなく文字列/配列で返す (印刷ページが描画する)。
//
// フェイルクローズ: この関数は hasTakoAccess 確認後にのみ呼ぶこと
// (呼び出し側 = /tako-report/[token]/print)。

import type { OwnerReportData } from "./owner-report-data";
import {
  classifyThirtyTwoType,
  selfContentFor,
  thirtyTwoEssence,
  thirtyTwoName,
  thirtyTwoImagePath,
  thirtyTwoGroup,
  type ThirtyTwoTypeId,
} from "./thirty-two-types";
import type { ThirtyTwoGroup } from "./thirty-two-content/character-32";
import { preferCutImage, preferFaceImage } from "./character-image";
import {
  buildDeepDive,
  estimateCompatFromGaps,
  type DeepDiveData,
  type EstimatedCompat,
} from "./tako-deepdive";
import {
  resolveFriendLoveChecklist,
  resolveLoveScene,
  resolveMoteHints,
  type MoteCheckItem,
} from "./friend-love-content";
import { LOVE_BY_TYPE_32 } from "./love-by-type-32";
import type { BigFiveDimension } from "./types";

export type TakoReportSheet = {
  /** 友達の表示名 (生値)。 */
  name: string;
  /** 見出し用の呼称 (例 "ゆかさん"。フォールバックは "友達")。 */
  viewer: string;
  type32: ThirtyTwoTypeId;
  group: ThirtyTwoGroup;
  essence: string;
  charName: string;
  imageSrc: string;
  faceSrc: string;
  /** その友達がつけたスコア (0-10)。 */
  scores: Partial<Record<BigFiveDimension, number>>;
  /** 本文 (取扱説明書を友達視点に変換した段落)。 */
  manualParas: string[];
  /** ◯◯さんが気になっているクセ (取扱注意ポイント) の段落。 */
  kuseParas: string[];
  /** 五つの性格傾向のギャップ (カード文言用)。 */
  deep: DeepDiveData | null;
  /** 恋愛本文 (先頭2段落 + デートシーン段落)。 */
  loveParas: string[];
  /** 隠れモテポイント (6)。 */
  loveChecks: MoteCheckItem[];
  /** モテるためのヒント (6)。 */
  loveHints: MoteCheckItem[];
  /** 相性 (推定): まとめ/深めるヒント8/壊すワナ8 込み。 */
  compat: EstimatedCompat | null;
  /** ひとことメッセージ (全文。無ければ空文字)。 */
  message: string;
};

/** OwnerReportData から友達1人ごとのレポート章データを組み立てる。 */
export function buildTakoReportSheets(data: OwnerReportData): TakoReportSheet[] {
  return data.friends.map((f) => {
    const type32 =
      f.perceivedType32 ?? classifyThirtyTwoType(f.perceivedScores);
    const rawName = f.name.trim();
    const viewer = rawName && rawName !== "ともだち" ? `${rawName}さん` : "友達";

    // 本文: /tako シート (MinnaTypeProse) と同じ変換。
    //   - 冒頭を「◯◯さんから見た + アナタ…」に
    //   - 中間再開段落 (Web ではグラフ直後) も「◯◯さんから見た…」で仕切り直す
    const sections = selfContentFor(type32).slice(0, 2);
    const manual = sections[0];
    const kuse = sections[1];
    const manualParas = (manual?.body ?? "").split("\n\n").filter(Boolean);
    if (manualParas[0]?.startsWith("アナタ")) {
      manualParas[0] = `${viewer}から見た${manualParas[0]}`;
    }
    const reopenIdx = Math.max(0, Math.floor(manualParas.length / 2) - 1) + 1;
    if (reopenIdx < manualParas.length) {
      let t = manualParas[reopenIdx];
      for (const conn of ["そして、", "そして", "しかも", "さらに"]) {
        if (t.startsWith(conn)) {
          t = t.slice(conn.length);
          break;
        }
      }
      manualParas[reopenIdx] = t.startsWith("アナタ")
        ? `${viewer}から見た${t}`
        : `${viewer}から見ると、${t}`;
    }

    // 恋愛: 先頭2段落 + デートシーン段落 (/tako と同じ)。
    const loveParas = (LOVE_BY_TYPE_32[type32]?.body ?? "")
      .split("\n\n")
      .filter(Boolean)
      .slice(0, 2);
    if (loveParas[0]?.startsWith("アナタの恋は")) {
      loveParas[0] = `${viewer}から見た${loveParas[0]}`;
    }
    const loveScene = resolveLoveScene(f.perceivedScores);
    if (loveScene) loveParas.push(loveScene);

    return {
      name: rawName || "ともだち",
      viewer,
      type32,
      group: thirtyTwoGroup(type32),
      essence: thirtyTwoEssence(type32),
      charName: thirtyTwoName(type32),
      imageSrc:
        f.perceivedImageSrc ?? preferCutImage(thirtyTwoImagePath(type32)),
      faceSrc: preferFaceImage(thirtyTwoImagePath(type32)),
      scores: f.perceivedScores,
      manualParas,
      kuseParas: (kuse?.body ?? "").split("\n\n").filter(Boolean),
      deep: buildDeepDive(data.selfScores, f.perceivedScores),
      loveParas,
      loveChecks: resolveFriendLoveChecklist(f.perceivedScores),
      loveHints: resolveMoteHints(f.perceivedScores),
      compat: estimateCompatFromGaps(data.selfScores, f.perceivedScores, viewer),
      message: f.message.trim(),
    };
  });
}
