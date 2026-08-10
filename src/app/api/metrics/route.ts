// スプレッドシート連携用の「主要な数値」エンドポイント (読み取り専用・集計のみ)。
// Google Apps Script の時間トリガーから GET し、1 行ずつ追記していく想定。
//
// 認証: Authorization: Bearer <METRICS_KEY>。ADMIN_KEY とは別トークンにして、
//        シートに置くトークンが管理画面 (/admin) を開けないようにする。
// 期間: ?from= / ?to= (ISO) 任意。未指定は全期間 (= 現時点の累計スナップショット)。
// 形式: 既定 JSON (Apps Script 向け)。?format=csv で metric,value の2列CSV (IMPORTDATA 向け)。

import {
  authorizeMetricsRequest,
  metricsPrivateHeaders,
} from "@/lib/metrics-access";
import { getCachedStats } from "@/lib/metrics-stats-cache";
import { NextRequest, NextResponse } from "next/server";

// 全期間の集計は成長中の events を読むため、DB負荷を制限したうえで実行時間を確保する。
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const access = authorizeMetricsRequest(request);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: metricsPrivateHeaders },
    );
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  // 累計集計は大量の events を読むため、Vercel Runtime Cacheで24時間共有する。
  // 30分おきのスプレッドシート取得がSupabaseのEgressを増やさないようにする。
  const s = await getCachedStats(from, to);

  // 小数は見やすさのため丸める (率は 0-1、平均は小数)。
  const round = (n: number) => Math.round(n * 1000) / 1000;

  // 主要な数値だけをフラット化。順序 = スプレッドシートの列順として安定させる。
  const metrics: Record<string, string | number> = {
    asOf: new Date().toISOString(),
    coreKpiReady: s.coreKpis.dataQuality.ready ? 1 : 0,
    coreKpiIssues: s.coreKpis.dataQuality.issues.join(" | "),
    // 経営KPI（業務データ正本・コホート追跡）。先頭に固定し、定期取得先でも
    // 最重要数字を同じ定義で参照できるようにする。
    coreDiagnosisCohortUsers: s.coreKpis.cohort.diagnosisUsers,
    diagnosisToPaidUsers: s.coreKpis.diagnosisToPaid.numerator,
    diagnosisToPaidRate: round(s.coreKpis.diagnosisToPaid.rate),
    diagnosisToFriendUsers: s.coreKpis.diagnosisToFriend.numerator,
    diagnosisToFriendRate: round(s.coreKpis.diagnosisToFriend.rate),
    paidCohortUsers: s.coreKpis.paidToFriend.denominator,
    paidToFriendUsers: s.coreKpis.paidToFriend.numerator,
    paidToFriendRate: round(s.coreKpis.paidToFriend.rate),
    arpuJpy: round(
      s.coreKpis.arpu.currencies.find((row) => row.currency === "jpy")
        ?.arpuMinor ?? 0,
    ),
    arpuKrw: round(
      s.coreKpis.arpu.currencies.find((row) => row.currency === "krw")
        ?.arpuMinor ?? 0,
    ),
    coreViralCoefficient: round(s.coreKpis.viralCoefficient.value),
    coreViralChildren: s.coreKpis.viralCoefficient.children,
    paymentUserMatchRate: round(s.coreKpis.dataQuality.paymentUserMatchRate),
    diagnosisStarted: s.diagnosisStarted,
    diagnosisCompleted: s.diagnosisCompleted,
    completionRate: round(s.completionRate),
    friendInviteClicked: s.shareCount,
    friendAnswerStarted: s.friendAnswerStarted,
    friendAnswerCompleted: s.friendAnswerCompleted,
    answerCompletionRate: round(s.answerCompletionRate),
    threeAchieved: s.threeAchieved,
    fiveAchieved: s.fiveAchieved,
    friendLandingViewed: s.viral.friendLandingViewed,
    friendToDiagClicked: s.friendToDiagClicked,
    resultRevisited: s.resultRevisited,
    totalUsers: s.totalUsers,
    avgChildPerParent: round(s.viral.avgChildPerParent),
    viralCoefficient: round(s.viral.viralCoefficient),
    // 課金ファネル (2026-07-13 追加。列は末尾に足す = 既存シートの列順を壊さない)
    paywallViewed: s.paywallFunnel[1]?.count ?? 0,
    paywallScrollClicked: s.paywallFunnel[2]?.count ?? 0,
    purchaseCtaClicked: s.paywallFunnel[3]?.count ?? 0,
    checkoutSessionCreated: s.paywallFunnel[4]?.count ?? 0,
    purchaseCompleted: s.purchaseCompleted,
    purchaseConversionRate: round(s.purchaseConversionRate),
    paidUsers: s.paidUsers,
    revenueJpy: s.revenueJpy,
    // 友達診断コホートファネル（2026-07-18 計測開始）
    friendFunnelMeasurementStartedAt:
      s.friendDiagnosisFunnel.measurementStartedAt,
    friendFunnelDiagnosisCompleted:
      s.friendDiagnosisFunnel.ownerFunnel[0]?.count ?? 0,
    friendFunnelResultReached:
      s.friendDiagnosisFunnel.ownerFunnel[1]?.count ?? 0,
    friendFunnelTakoReached:
      s.friendDiagnosisFunnel.ownerFunnel[2]?.count ?? 0,
    friendFunnelTakoReachRate: round(
      s.friendDiagnosisFunnel.attention.takoReachRate,
    ),
    friendFunnelInviteAction:
      s.friendDiagnosisFunnel.ownerFunnel[3]?.count ?? 0,
    friendFunnelFriendReached:
      s.friendDiagnosisFunnel.ownerFunnel[4]?.count ?? 0,
    friendFunnelOwnerWithAnswer:
      s.friendDiagnosisFunnel.ownerFunnel[5]?.count ?? 0,
    friendFunnelFriendLandingSessions:
      s.friendDiagnosisFunnel.friendFunnel[0]?.count ?? 0,
    friendFunnelFriendAnswerSessions:
      s.friendDiagnosisFunnel.friendFunnel[1]?.count ?? 0,
    friendFunnelSelfDiagnosisClicks:
      s.friendDiagnosisFunnel.friendFunnel[2]?.count ?? 0,
    friendFunnelChildDiagnosisCompleted:
      s.friendDiagnosisFunnel.friendFunnel[3]?.count ?? 0,
    takoBadgeShown: s.friendDiagnosisFunnel.attention.badgeShown,
    takoBadgeClicked: s.friendDiagnosisFunnel.attention.badgeClicked,
    takoBadgeClickRate: round(
      s.friendDiagnosisFunnel.attention.badgeClickRate,
    ),
    // 運命の設計図（末尾追加。既存シートの列順を壊さない）
    unmeiLpViewed: s.unmei.funnel[0]?.count ?? 0,
    unmeiPurchaseStarted: s.unmei.funnel[1]?.count ?? 0,
    unmeiCheckoutSessionCreated: s.unmei.funnel[2]?.count ?? 0,
    unmeiPurchaseCompleted: s.unmei.purchases.total,
    unmeiPurchaseBasic: s.unmei.purchases.basic,
    unmeiPurchaseUpgrade: s.unmei.purchases.upgrade,
    unmeiRevenueJpy:
      s.unmei.revenue.currencies.find((row) => row.currency === "jpy")
        ?.netRevenueMinor ?? 0,
    unmeiBirthFormViewed: s.unmei.birthForm.viewed,
    unmeiBirthFormSubmitted: s.unmei.birthForm.submitted,
    unmeiBirthFormSubmitRate: round(s.unmei.birthForm.submitRate),
    unmeiReadingViewed: s.unmei.funnel[6]?.count ?? 0,
    unmeiBadgeShown: s.unmei.navBadge.shown,
    unmeiBadgeClicked: s.unmei.navBadge.clicked,
    unmeiBadgeClickRate: round(s.unmei.navBadge.clickRate),
    // 招待の解剖 (2026-08-04 追加。末尾に足す = 既存シートの列順を壊さない)
    takoBadgeShowRate: round(s.friendDiagnosisFunnel.attention.badgeShowRate),
    takoInviteUiShownOwners: s.friendDiagnosisFunnel.inviteDetail.uiShownOwners,
    takoInviteClickOwners: s.friendDiagnosisFunnel.inviteDetail.clickOwners,
    takoInviteClickActions: s.friendDiagnosisFunnel.inviteDetail.clickActions,
    takoInviteUiToClickRate: round(
      s.friendDiagnosisFunnel.inviteDetail.uiToClickRate,
    ),
    // 運命の設計図チャット決済ファネル (2026-08-06 追加。末尾に足す = 既存シートの列順を壊さない)
    unmeiChatLaunched: s.unmei.chatFunnel[1]?.count ?? 0,
    unmeiChatBirthViewed: s.unmei.chatFunnel[2]?.count ?? 0,
    unmeiChatBirthSubmitted: s.unmei.chatFunnel[3]?.count ?? 0,
    unmeiChatCheckoutReached: s.unmei.chatFunnel[4]?.count ?? 0,
    unmeiChatPurchases: s.unmei.chatFunnel[5]?.count ?? 0,
  };

  const format = request.nextUrl.searchParams.get("format");
  if (format === "csv") {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv =
      "﻿" +
      Object.entries(metrics)
        .map(([k, v]) => `${esc(k)},${esc(v)}`)
        .join("\n");
    return new NextResponse(csv, {
      headers: {
        ...metricsPrivateHeaders,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }

  return NextResponse.json(metrics, { headers: metricsPrivateHeaders });
}
