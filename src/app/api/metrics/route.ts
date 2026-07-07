// スプレッドシート連携用の「主要な数値」エンドポイント (読み取り専用・集計のみ)。
// Google Apps Script の時間トリガーから ?key=<METRICS_KEY> で GET し、1 行ずつ追記していく想定。
//
// 認証: クエリ ?key= と env METRICS_KEY を照合。ADMIN_KEY とは別トークンにして、
//        シートに置くトークンが管理画面 (/admin) を開けないようにする。
// 期間: ?from= / ?to= (ISO) 任意。未指定は全期間 (= 現時点の累計スナップショット)。
// 形式: 既定 JSON (Apps Script 向け)。?format=csv で metric,value の2列CSV (IMPORTDATA 向け)。

import { computeStats } from "@/lib/admin-stats";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const metricsKey = process.env.METRICS_KEY;
  if (!metricsKey) {
    return NextResponse.json(
      { error: "METRICS_KEY is not configured" },
      { status: 500 },
    );
  }
  const key = request.nextUrl.searchParams.get("key");
  if (key !== metricsKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const s = await computeStats(from, to);

  // 小数は見やすさのため丸める (率は 0-1、平均は小数)。
  const round = (n: number) => Math.round(n * 1000) / 1000;

  // 主要な数値だけをフラット化。順序 = スプレッドシートの列順として安定させる。
  const metrics: Record<string, string | number> = {
    asOf: new Date().toISOString(),
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
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  }

  return NextResponse.json(metrics);
}
