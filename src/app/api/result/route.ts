import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import type {
  BigFiveDimension,
  CModifier,
  FacetId,
  NModifier,
} from "@/lib/types";

type StoredScores = Partial<Record<BigFiveDimension, number>> & {
  facetScores?: Record<FacetId, number>;
  fullCode?: string;
  cModifier?: CModifier;
  nModifier?: NModifier;
  modifierLabel?: string;
};

function extractCoreScores(
  stored: StoredScores,
): Record<BigFiveDimension, number> | null {
  const dims: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
  if (dims.every((d) => typeof stored[d] === "number")) {
    return {
      E: stored.E as number,
      A: stored.A as number,
      O: stored.O as number,
      C: stored.C as number,
      N: stored.N as number,
    };
  }
  return null;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const code = request.nextUrl.searchParams.get("code");

  if (!token && !code) {
    return NextResponse.json({ error: "Missing token or code" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("users")
    .select("id, type_id, scores, invite_code, owner_token, display_name");

  if (token) {
    query = query.eq("owner_token", token);
  } else {
    query = query.eq("invite_code", code!);
  }

  const { data: user, error: userError } = await query.single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: friendAnswers } = await supabaseAdmin
    .from("friend_answers")
    .select("id, answers, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const stored = (user.scores ?? {}) as StoredScores;
  const coreScores = extractCoreScores(stored);

  return NextResponse.json({
    typeId: user.type_id,
    scores: coreScores,
    facetScores: stored.facetScores ?? null,
    fullCode: stored.fullCode ?? null,
    cModifier: stored.cModifier ?? null,
    nModifier: stored.nModifier ?? null,
    modifierLabel: stored.modifierLabel ?? null,
    inviteCode: user.invite_code,
    ownerToken: user.owner_token ?? null,
    displayName: user.display_name ?? null,
    friendAnswers: friendAnswers ?? [],
    friendCount: friendAnswers?.length ?? 0,
  });
}
