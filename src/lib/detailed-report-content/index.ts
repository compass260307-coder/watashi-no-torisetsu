// 詳細レポート本文の統合インデックス。
// グループ×前後半の 8 ファイル (各 4 タイプ) をマージして 32 タイプ全量を提供する。

import type { ThirtyTwoTypeId } from "../thirty-two-types";
import type { DetailedReport } from "./types";
import { detailedReportSky1 } from "./report-sky-1";
import { detailedReportSky2 } from "./report-sky-2";
import { detailedReportLand1 } from "./report-land-1";
import { detailedReportLand2 } from "./report-land-2";
import { detailedReportSea1 } from "./report-sea-1";
import { detailedReportSea2 } from "./report-sea-2";
import { detailedReportUnknown1 } from "./report-unknown-1";
import { detailedReportUnknown2 } from "./report-unknown-2";
import { expandDetailedReport } from "./expand-report";

export type { DetailedReport, ReportChapter, ReportSection, ReportBullet } from "./types";
export { REPORT_CHAPTER_TITLES } from "./types";

const ALL: Partial<Record<ThirtyTwoTypeId, DetailedReport>> = {
  ...detailedReportSky1,
  ...detailedReportSky2,
  ...detailedReportLand1,
  ...detailedReportLand2,
  ...detailedReportSea1,
  ...detailedReportSea2,
  ...detailedReportUnknown1,
  ...detailedReportUnknown2,
};

/** 32 タイプの詳細レポート本文。未登録タイプは null (ページ側で 404 相当の扱い)。 */
export function detailedReportFor(id: ThirtyTwoTypeId): DetailedReport | null {
  const report = ALL[id];
  return report ? expandDetailedReport(id, report) : null;
}

/** 本文が欠けているタイプ ID の一覧 (QA 用) */
export function missingDetailedReportKeys(
  allIds: ThirtyTwoTypeId[],
): ThirtyTwoTypeId[] {
  return allIds.filter((id) => !ALL[id]);
}
