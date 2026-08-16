import "server-only";

import { getCache } from "@vercel/functions";
import { createHash } from "node:crypto";

import { computeStats } from "@/lib/admin-stats";

const METRICS_CACHE_TTL_SECONDS = 24 * 60 * 60;
// 現在時刻を含む期間 (今日・全期間など) は数字が動き続けるので、24時間キャッシュすると
// 管理画面が「更新されなくなった」ように見える (2026-08-10)。egress削減効果は保ちつつ
// 5分で追従させる。
const LIVE_RANGE_TTL_SECONDS = 5 * 60;
// 「過去だけの期間は不変」は厳密には誤り: コホートKPI (課金率/ARPU) は診断日以降の
// 決済・返金・友達回答を現在まで追跡するため、昨日などの直近期間は日付が終わった後も
// 数値が動く。終端が48時間以内の期間は1時間で追従させ、それより古い期間のみ24時間。
const RECENT_PAST_TTL_SECONDS = 60 * 60;
const RECENT_PAST_WINDOW_MS = 48 * 60 * 60 * 1000;
const LAST_GOOD_TTL_SECONDS = 7 * 24 * 60 * 60;
// 計測スキーマのv4と旧キャッシュを分離する。キーはさらにデプロイ単位で分ける。
const metricsCache = getCache({ namespace: "metrics-stats-v4" });

type AdminStats = Awaited<ReturnType<typeof computeStats>>;

// to が無い (全期間) / 現在以降 (今日・今週など) は「現在を含む期間」。
function rangeTtlSeconds(to: string | null): number {
  if (!to) return LIVE_RANGE_TTL_SECONDS;
  const end = Date.parse(to);
  if (!Number.isFinite(end) || end >= Date.now()) {
    return LIVE_RANGE_TTL_SECONDS;
  }
  if (end >= Date.now() - RECENT_PAST_WINDOW_MS) {
    return RECENT_PAST_TTL_SECONDS;
  }
  return METRICS_CACHE_TTL_SECONDS;
}

function statsCacheKey(from: string | null, to: string | null): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        from,
        to,
        // 集計結果の形状はコードと共に変わる。別デプロイが書いたエントリを読むと
        // 形状不一致で管理画面がクラッシュするため (2026-08-10 障害: chatFunnel 無しの
        // 旧形状が配信され unmei.chatFunnel.map で全損)、キーをデプロイ単位に分ける。
        // preview / production 間の混線も同時に防ぐ。
        deployment: process.env.VERCEL_DEPLOYMENT_ID ?? "local",
      }),
    )
    .digest("hex");
}

function lastGoodCacheKey(from: string | null, to: string | null): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        from,
        to,
        shape: "admin-stats-v4",
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local",
      }),
    )
    .digest("hex");
}

function isAdminStats(value: unknown): value is AdminStats {
  if (!value || typeof value !== "object") return false;
  const stats = value as Record<string, unknown>;
  const unmei = stats.unmei as Record<string, unknown> | undefined;
  const coreKpis = stats.coreKpis as Record<string, unknown> | undefined;
  return (
    typeof stats.diagnosisStarted === "number" &&
    Array.isArray(stats.paywallFunnel) &&
    !!unmei &&
    Array.isArray(unmei.chatFunnel) &&
    !!coreKpis &&
    typeof coreKpis.dataQuality === "object"
  );
}

export async function getCachedStats(
  from: string | null,
  to: string | null,
  // forceFresh: 管理画面の「更新」ボタン用。キャッシュを読まず再計算して上書きする。
  options: { forceFresh?: boolean } = {},
): Promise<AdminStats> {
  const key = statsCacheKey(from, to);
  const lastGoodKey = lastGoodCacheKey(from, to);

  if (!options.forceFresh) {
    try {
      const cached = await metricsCache.get(key);
      if (isAdminStats(cached)) return cached;
    } catch (error) {
      // ローカル実行などでRuntime Cacheが使えない場合も、集計自体は継続する。
      console.warn("[metrics-cache] get failed; computing directly", error);
    }
  }

  let stats: AdminStats;
  try {
    stats = await computeStats(from, to);
  } catch (error) {
    // 全期間集計がDBのstatement_timeoutに当たっても、直近の正常スナップショットが
    // あれば管理画面と定期取得を全損させない。形状検査で旧コードのキャッシュ混入を防ぐ。
    try {
      const lastGood = await metricsCache.get(lastGoodKey);
      if (isAdminStats(lastGood)) {
        console.warn(
          "[metrics-cache] compute failed; returning last good snapshot",
          error,
        );
        return lastGood;
      }
    } catch (cacheError) {
      console.warn("[metrics-cache] last good get failed", cacheError);
    }
    throw error;
  }

  try {
    await metricsCache.set(key, stats, {
      ttl: rangeTtlSeconds(to),
      tags: ["metrics-stats"],
      name: "metrics-stats-snapshot",
    });
    await metricsCache.set(lastGoodKey, stats, {
      ttl: LAST_GOOD_TTL_SECONDS,
      tags: ["metrics-stats"],
      name: "metrics-stats-last-good",
    });
  } catch (error) {
    console.warn("[metrics-cache] set failed; returning uncached result", error);
  }

  return stats;
}
