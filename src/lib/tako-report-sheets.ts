// 友達診断 完全版レポート (PDF) 用の、友達1人ぶんの章データを純データで組み立てる。
// /tako/[token] の friendSheets 派生ロジックと同じ素材 (32タイプ本文・恋愛・モテ・
// 相性推定) を、JSX ではなく文字列/配列で返す (印刷ページが描画する)。
//
// フェイルクローズ: この関数は hasTakoAccess 確認後にのみ呼ぶこと
// (呼び出し側 = /tako-report/[token]/print)。

import type { OwnerReportData } from "./owner-report-data";
import {
  classifyThirtyTwoType,
  perceivedContentFor,
  perceivedManualFor,
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
  buildMinnaProse,
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
import { buildDimensionGaps } from "./perception-analysis";
import type { BigFiveDimension } from "./types";
import type { ResultLocale } from "@/i18n/result";
import { buildKoSelfSections } from "@/i18n/ko/me";
import {
  KO_LOVE_BY_TYPE_32,
  KO_PERCEIVED_BY_TYPE_32,
} from "@/i18n/ko/me-content-32";
import { KO_RESULT_TYPES } from "@/i18n/ko/result";

const REPORT_AXIS_ORDER: readonly BigFiveDimension[] = ["O", "C", "E", "A", "N"];

const REPORT_AXIS_COPY: Record<
  BigFiveDimension,
  { label: string; low: string; high: string }
> = {
  O: {
    label: "新しい体験へのひらかれ",
    low: "慣れ親しんだものを大切にする",
    high: "新しい世界を楽しむ",
  },
  C: {
    label: "ものごとの進め方",
    low: "流れに合わせて柔軟に進む",
    high: "計画を立てて着実に進む",
  },
  E: {
    label: "エネルギーの向かう先",
    low: "ひとりの時間で整える",
    high: "人との時間で活気づく",
  },
  A: {
    label: "人との向き合い方",
    low: "率直さと合理性を重んじる",
    high: "調和と思いやりを重んじる",
  },
  N: {
    label: "刺激への敏感さ",
    low: "落ち着いて受け止める",
    high: "細かな変化を感じ取る",
  },
};

const KO_REPORT_AXIS_COPY: typeof REPORT_AXIS_COPY = {
  O: {
    label: "새로운 경험에 대한 개방성",
    low: "익숙함을 중시",
    high: "새로움을 즐김",
  },
  C: {
    label: "일을 진행하는 방식",
    low: "유연하게 진행",
    high: "계획적으로 진행",
  },
  E: {
    label: "에너지가 향하는 곳",
    low: "혼자 충전",
    high: "함께할 때 활기",
  },
  A: {
    label: "사람을 대하는 방식",
    low: "솔직함과 합리",
    high: "조화와 배려",
  },
  N: {
    label: "자극에 대한 민감성",
    low: "차분히 수용",
    high: "변화에 민감",
  },
};

export type TakoReportOverviewAxis = {
  key: BigFiveDimension;
  label: string;
  selfPercent: number;
  friendPercent: number;
  diffPoints: number;
  friendLeaning: string;
  friendRange: number;
};

export type TakoReportOverview = {
  type32: ThirtyTwoTypeId;
  group: ThirtyTwoGroup;
  essence: string;
  charName: string;
  imageSrc: string;
  friendCount: number;
  agreement: number;
  profileParas: string[];
  gapParas: string[];
  strengths: { title: string; body: string }[];
  surprises: { title: string; body: string }[];
  axes: TakoReportOverviewAxis[];
  biggestGap: TakoReportOverviewAxis;
  mostSharedAxis: TakoReportOverviewAxis | null;
  mostVariedAxis: TakoReportOverviewAxis | null;
};

function replaceCollectiveViewer(
  text: string,
  locale: ResultLocale,
): string {
  if (locale === "ko") {
    return text
      .replaceAll("【B】님", "친구")
      .replaceAll("{B}님", "친구")
      .replaceAll("【B】", "친구들")
      .replaceAll("{B}", "친구들");
  }
  return text
    .replaceAll("【B】さん", "友達")
    .replaceAll("{B}さん", "友達")
    .replaceAll("【B】", "みんな")
    .replaceAll("{B}", "みんな");
}

/**
 * 友達診断PDFの巻頭に載せる「みんなの目」総合分析。
 * 課金判定後にだけ呼ぶこと（buildTakoReportSheets と同じ扱い）。
 */
export function buildTakoReportOverview(
  data: OwnerReportData,
  locale: ResultLocale = "ja",
): TakoReportOverview | null {
  const friendScores = data.friendAvgScores;
  if (!friendScores || data.friends.length === 0) return null;

  const type32 = classifyThirtyTwoType(friendScores);
  const deep = buildDeepDive(data.selfScores, friendScores, locale);
  if (!deep) return null;

  const gapByKey = new Map(
    buildDimensionGaps(data.selfScores, friendScores).map((gap) => [gap.key, gap]),
  );
  const axes = REPORT_AXIS_ORDER.map((key) => {
    const gap = gapByKey.get(key)!;
    const values = data.friends
      .map((friend) => friend.perceivedScores[key])
      .filter((value): value is number => typeof value === "number")
      .map((value) => Math.max(0, Math.min(100, Math.round(value * 10))));
    const friendRange =
      values.length > 1 ? Math.max(...values) - Math.min(...values) : 0;
    const copy =
      locale === "ko" ? KO_REPORT_AXIS_COPY[key] : REPORT_AXIS_COPY[key];
    return {
      key,
      label: copy.label,
      selfPercent: gap.selfPercent,
      friendPercent: gap.otherPercent,
      diffPoints: gap.diffPoints,
      friendLeaning: gap.otherPercent >= 50 ? copy.high : copy.low,
      friendRange,
    };
  });

  const biggestGap = [...axes].sort((a, b) => b.diffPoints - a.diffPoints)[0];
  const byRange = [...axes].sort((a, b) => a.friendRange - b.friendRange);
  const hasSeveralViewers = data.friends.length > 1;
  const perceived =
    locale === "ko"
      ? KO_PERCEIVED_BY_TYPE_32[type32]
      : perceivedContentFor(type32);
  const koType = locale === "ko" ? KO_RESULT_TYPES[type32] : null;

  return {
    type32,
    group: thirtyTwoGroup(type32),
    essence: koType?.essence ?? thirtyTwoEssence(type32),
    charName: koType?.name ?? thirtyTwoName(type32),
    imageSrc: preferCutImage(thirtyTwoImagePath(type32)),
    friendCount: data.friends.length,
    agreement: deep.agreement,
    profileParas:
      locale === "ko"
        ? buildKoSelfSections(type32, friendScores)[0].body
            .split("\n\n")
            .filter(Boolean)
        : perceivedManualFor(type32).split("\n\n").filter(Boolean),
    gapParas: buildMinnaProse(deep, undefined, locale),
    strengths: (perceived?.strengths ?? []).slice(0, 4).map((item) => ({
      title: item.title,
      body: replaceCollectiveViewer(item.body, locale),
    })),
    surprises: (perceived?.surprises ?? []).slice(0, 4).map((item) => ({
      title: item.title,
      body: replaceCollectiveViewer(item.body, locale),
    })),
    axes,
    biggestGap,
    mostSharedAxis: hasSeveralViewers ? byRange[0] : null,
    mostVariedAxis: hasSeveralViewers ? byRange[byRange.length - 1] : null,
  };
}

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
export function buildTakoReportSheets(
  data: OwnerReportData,
  locale: ResultLocale = "ja",
): TakoReportSheet[] {
  return data.friends.map((f) => {
    const type32 =
      f.perceivedType32 ?? classifyThirtyTwoType(f.perceivedScores);
    const rawName = f.name.trim();
    const viewer =
      locale === "ko"
        ? rawName && rawName !== "ともだち"
          ? `${rawName}님`
          : "친구"
        : rawName && rawName !== "ともだち"
          ? `${rawName}さん`
          : "友達";

    // 本文: /tako シート (MinnaTypeProse) と同じ変換。
    //   - 冒頭を「◯◯さんから見た + アナタ…」に
    //   - 中間再開段落 (Web ではグラフ直後) も「◯◯さんから見た…」で仕切り直す
    const sections =
      locale === "ko"
        ? buildKoSelfSections(type32, f.perceivedScores).slice(0, 2)
        : selfContentFor(type32).slice(0, 2);
    const manual = sections[0];
    const kuse = sections[1];
    const manualParas = (manual?.body ?? "").split("\n\n").filter(Boolean);
    if (locale === "ko" && manualParas[0]?.startsWith("당신은")) {
      manualParas[0] = `${viewer}의 눈에 비친 당신은${manualParas[0].slice("당신은".length)}`;
    } else if (manualParas[0]?.startsWith("アナタ")) {
      manualParas[0] = `${viewer}から見た${manualParas[0]}`;
    }
    const reopenIdx = Math.max(0, Math.floor(manualParas.length / 2) - 1) + 1;
    if (locale === "ja" && reopenIdx < manualParas.length) {
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
    const loveBody =
      locale === "ko"
        ? KO_LOVE_BY_TYPE_32[type32]?.body
        : LOVE_BY_TYPE_32[type32]?.body;
    const loveParas = (loveBody ?? "")
      .split("\n\n")
      .filter(Boolean)
      .slice(0, 2);
    if (locale === "ko" && loveParas[0]?.startsWith("당신")) {
      loveParas[0] = `${viewer}의 눈에 비친 ${loveParas[0]}`;
    } else if (loveParas[0]?.startsWith("アナタの恋は")) {
      loveParas[0] = `${viewer}から見た${loveParas[0]}`;
    }
    const loveScene = resolveLoveScene(f.perceivedScores, locale);
    if (loveScene) loveParas.push(loveScene);

    return {
      name: rawName || (locale === "ko" ? "친구" : "ともだち"),
      viewer,
      type32,
      group: thirtyTwoGroup(type32),
      essence:
        locale === "ko"
          ? KO_RESULT_TYPES[type32].essence
          : thirtyTwoEssence(type32),
      charName:
        locale === "ko"
          ? KO_RESULT_TYPES[type32].name
          : thirtyTwoName(type32),
      imageSrc:
        f.perceivedImageSrc ?? preferCutImage(thirtyTwoImagePath(type32)),
      faceSrc: preferFaceImage(thirtyTwoImagePath(type32)),
      scores: f.perceivedScores,
      manualParas,
      kuseParas: (kuse?.body ?? "").split("\n\n").filter(Boolean),
      deep: buildDeepDive(data.selfScores, f.perceivedScores, locale),
      loveParas,
      loveChecks: resolveFriendLoveChecklist(f.perceivedScores, locale),
      loveHints: resolveMoteHints(f.perceivedScores, locale),
      compat: estimateCompatFromGaps(
        data.selfScores,
        f.perceivedScores,
        viewer,
        locale,
      ),
      message: f.message.trim(),
    };
  });
}
