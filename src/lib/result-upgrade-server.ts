import "server-only";

import { isThirtyTwoEnabled } from "@/lib/feature-flags";
import { preferCutImage } from "@/lib/character-image";
import {
  characterImagePath,
  classifySixteenType,
} from "@/lib/sixteen-types";
import {
  classifyThirtyTwoType,
  thirtyTwoImagePath,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { ResultUpgradeRow } from "@/lib/result-upgrade";

type StoredScores = Partial<Record<BigFiveDimension, number>>;

export function isMissingResultUpgradeTable(error: unknown): boolean {
  const value = error as { code?: string; message?: string } | null;
  const text = `${value?.code ?? ""} ${value?.message ?? ""}`.toLowerCase();
  return (
    text.includes("42p01") ||
    text.includes("pgrst205") ||
    (text.includes("result_upgrades") && text.includes("not found"))
  );
}
export async function loadResultUpgradeForUser(
  userId: string,
): Promise<ResultUpgradeRow | null> {
  const { data, error } = await supabaseAdmin
    .from("result_upgrades")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (!isMissingResultUpgradeTable(error)) {
      console.error("[result-upgrade] load failed:", error);
    }
    return null;
  }
  return (data as ResultUpgradeRow | null) ?? null;
}

export async function resolveResultUpgradeBase(userId: string): Promise<{
  sourceTypeId: string;
  sourceCharacterPath: string;
  scores: StoredScores;
}> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("scores")
    .eq("id", userId)
    .single();
  if (error || !data) {
    throw new Error("diagnosis result not found");
  }

  const scores = (data.scores ?? {}) as StoredScores;
  if (isThirtyTwoEnabled()) {
    const sourceTypeId = classifyThirtyTwoType(scores);
    return {
      sourceTypeId,
      sourceCharacterPath: preferCutImage(thirtyTwoImagePath(sourceTypeId)),
      scores,
    };
  }

  const sourceTypeId = classifySixteenType(scores);
  return {
    sourceTypeId,
    sourceCharacterPath: preferCutImage(characterImagePath(sourceTypeId)),
    scores,
  };
}
