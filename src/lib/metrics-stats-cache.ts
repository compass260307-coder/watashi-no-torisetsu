import "server-only";

import { getCache } from "@vercel/functions";
import { createHash } from "node:crypto";

import { computeStats } from "@/lib/admin-stats";

const METRICS_CACHE_TTL_SECONDS = 24 * 60 * 60;
const metricsCache = getCache({ namespace: "metrics-stats-v1" });

type AdminStats = Awaited<ReturnType<typeof computeStats>>;

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

export async function getCachedStats(
  from: string | null,
  to: string | null,
): Promise<AdminStats> {
  const key = statsCacheKey(from, to);

  try {
    const cached = await metricsCache.get(key);
    if (cached) return cached as AdminStats;
  } catch (error) {
    // ローカル実行などでRuntime Cacheが使えない場合も、集計自体は継続する。
    console.warn("[metrics-cache] get failed; computing directly", error);
  }

  const stats = await computeStats(from, to);

  try {
    await metricsCache.set(key, stats, {
      ttl: METRICS_CACHE_TTL_SECONDS,
      tags: ["metrics-stats"],
      name: "metrics-stats-snapshot",
    });
  } catch (error) {
    console.warn("[metrics-cache] set failed; returning uncached result", error);
  }

  return stats;
}
