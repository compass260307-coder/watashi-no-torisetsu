import { supabaseAdmin } from "@/lib/supabase-server";
import {
  buildReportData,
  REPORT_FRIEND_THRESHOLD,
  type FriendAnswerRecord,
} from "@/lib/report-data";
import type {
  BigFiveDimension,
  CModifier,
  FacetId,
  NModifier,
  TorisetsuTypeId,
} from "@/lib/types";
import { FACET_TO_DIMENSION } from "@/lib/types";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import { friendQuestions } from "@/lib/friend-questions";
import {
  buildFullCode,
  classifyModifier,
} from "@/lib/diagnosis";
import { getModifierLabel } from "@/lib/modifier-data";
import { NextRequest, NextResponse } from "next/server";

const VALID_TYPE_IDS = new Set<string>(Object.keys(torisetsuTypes));

const ALL_FACETS: FacetId[] = [
  "E_assertiveness",
  "E_warmth",
  "A_cooperation",
  "A_sympathy",
  "O_adventurousness",
  "O_imagination",
  "C_achievement",
  "C_orderliness",
  "N_volatility",
  "N_anxiety",
];

type StoredScores = Partial<Record<BigFiveDimension, number>> & {
  facetScores?: Record<FacetId, number>;
  fullCode?: string;
  cModifier?: CModifier;
  nModifier?: NModifier;
  modifierLabel?: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * 0-10 スケールの自己評価値を、1-7 スケールの友達スケール回答値 (整数) に変換。
 * ±1 のジッターを加えて自然なズレを作る。
 */
function jitterTo7(selfScore0to10: number): number {
  const base = (selfScore0to10 / 10) * 6 + 1; // 1..7
  const offset = (Math.random() * 2 - 1) * 1.0;
  return Math.round(clamp(base + offset, 1, 7));
}

/**
 * ダミーの友達回答を生成 (dev モード用)。
 * - scale 質問 (id 1-10): 1-7 整数
 * - choice 質問 (id 11-13): 候補からランダム
 *
 * scale 質問の dim マッピングは friendQuestions.ts の facetId 経由で取得し、
 * selfScores (0-10) を基準値として使う。
 */
function generateDummyFriendAnswer(
  selfScores: Record<BigFiveDimension, number>,
): FriendAnswerRecord {
  const answers: Record<string, string | number> = {};

  for (const q of friendQuestions) {
    if (q.type === "scale" && q.facetId) {
      const dim = FACET_TO_DIMENSION[q.facetId];
      answers[String(q.id)] = jitterTo7(selfScores[dim]);
    } else if (q.type === "choice" && q.choices && q.choices.length > 0) {
      answers[String(q.id)] = pickRandom(q.choices);
    }
  }

  return {
    answers,
    created_at: new Date().toISOString(),
  };
}

function buildSampleReport() {
  // 0-10 スケールの自己評価
  const selfScores: Record<BigFiveDimension, number> = {
    E: 7.5,
    A: 6.8,
    O: 8.0,
    C: 5.0,
    N: 4.5,
  };
  // 中央近辺の facet スコア (FacetBarChart プレビュー用)
  const selfFacetScores: Record<FacetId, number> = {
    E_assertiveness: 7.0,
    E_warmth: 8.0,
    A_cooperation: 6.5,
    A_sympathy: 7.0,
    O_adventurousness: 8.5,
    O_imagination: 7.5,
    C_achievement: 5.5,
    C_orderliness: 4.5,
    N_volatility: 5.0,
    N_anxiety: 4.0,
  };
  // 3 件の固定友達回答 (新質問構造: scale id 1-10 + choice id 11-13)
  const friendAnswers: FriendAnswerRecord[] = [
    {
      answers: {
        "1": 6,
        "2": 7,
        "3": 5,
        "4": 6,
        "5": 7,
        "6": 6,
        "7": 5,
        "8": 4,
        "9": 5,
        "10": 4,
        "11": "一緒にいて楽しい",
        "12": "🦮 ゴールデンレトリバー（人懐っこい）",
        "13": "めちゃくちゃ笑った瞬間",
      },
      created_at: "2026-04-01T12:00:00Z",
    },
    {
      answers: {
        "1": 5,
        "2": 6,
        "3": 6,
        "4": 7,
        "5": 6,
        "6": 7,
        "7": 4,
        "8": 5,
        "9": 4,
        "10": 5,
        "11": "刺激をもらえる",
        "12": "🐱 猫（マイペース）",
        "13": "助けてもらった瞬間",
      },
      created_at: "2026-04-02T12:00:00Z",
    },
    {
      answers: {
        "1": 7,
        "2": 7,
        "3": 5,
        "4": 6,
        "5": 7,
        "6": 6,
        "7": 6,
        "8": 4,
        "9": 5,
        "10": 4,
        "11": "素でいられる",
        "12": "🦦 カワウソ（好奇心旺盛）",
        "13": "意外な一面を見た瞬間",
      },
      created_at: "2026-04-03T12:00:00Z",
    },
  ];

  const typeId: TorisetsuTypeId = "festival-sun";
  const { cModifier, nModifier } = classifyModifier(selfScores);
  const fullCode = buildFullCode(typeId, cModifier, nModifier);
  const modifierLabel = getModifierLabel(cModifier, nModifier);

  const report = buildReportData({
    ownerToken: "sample",
    typeId,
    selfScores,
    friendAnswers,
    selfFacetScores,
    fullCode,
    cModifier,
    nModifier,
    modifierLabel,
  });
  return { ...report, isSample: true };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const isDevRequested = request.nextUrl.searchParams.get("dev") === "true";
  const requestAdminKey = request.nextUrl.searchParams.get("adminKey");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  // サンプルレポート (認証なし、固定 mock データ)
  if (token === "sample") {
    return NextResponse.json(buildSampleReport());
  }

  let isDev = false;
  if (isDevRequested) {
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey || requestAdminKey !== adminKey) {
      return NextResponse.json(
        { error: "Unauthorized for dev mode" },
        { status: 401 },
      );
    }
    isDev = true;
  }

  // forceType: dev モード認証時のみ有効。不正な値は無視。
  const forceTypeRaw = request.nextUrl.searchParams.get("forceType");
  const forceType: TorisetsuTypeId | null =
    isDev && forceTypeRaw && VALID_TYPE_IDS.has(forceTypeRaw)
      ? (forceTypeRaw as TorisetsuTypeId)
      : null;

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, type_id, scores, owner_token")
    .eq("owner_token", token)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: friendAnswers } = await supabaseAdmin
    .from("friend_answers")
    .select("answers, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const stored = (user.scores ?? {}) as StoredScores;
  const selfScores: Record<BigFiveDimension, number> = {
    E: typeof stored.E === "number" ? stored.E : 5,
    A: typeof stored.A === "number" ? stored.A : 5,
    O: typeof stored.O === "number" ? stored.O : 5,
    C: typeof stored.C === "number" ? stored.C : 5,
    N: typeof stored.N === "number" ? stored.N : 5,
  };

  // ファセットスコア: 保存値があればそれを、無ければ未指定 (FacetBarChart は表示しない)
  const selfFacetScores: Record<FacetId, number> | undefined = stored.facetScores
    ? (Object.fromEntries(
        ALL_FACETS.map((f) => [f, stored.facetScores?.[f] ?? 5]),
      ) as Record<FacetId, number>)
    : undefined;

  const typeId = forceType ?? (user.type_id as TorisetsuTypeId);

  // フルコード等は保存されていれば使用、無ければ scores から再計算
  const computed = (() => {
    const { cModifier, nModifier } = classifyModifier(selfScores);
    return {
      cModifier,
      nModifier,
      fullCode: buildFullCode(typeId, cModifier, nModifier),
      modifierLabel: getModifierLabel(cModifier, nModifier),
    };
  })();

  const realAnswers: FriendAnswerRecord[] = (friendAnswers ?? []).map((r) => ({
    answers: r.answers as Record<string, string | number>,
    created_at: r.created_at as string,
  }));

  let answersForReport = realAnswers;
  if (isDev && realAnswers.length < REPORT_FRIEND_THRESHOLD) {
    const need = REPORT_FRIEND_THRESHOLD - realAnswers.length;
    const dummies = Array.from({ length: need }, () =>
      generateDummyFriendAnswer(selfScores),
    );
    answersForReport = [...realAnswers, ...dummies];
  }

  const report = buildReportData({
    ownerToken: user.owner_token as string,
    typeId,
    selfScores,
    friendAnswers: answersForReport,
    selfFacetScores,
    fullCode: stored.fullCode ?? computed.fullCode,
    cModifier: stored.cModifier ?? computed.cModifier,
    nModifier: stored.nModifier ?? computed.nModifier,
    modifierLabel: stored.modifierLabel ?? computed.modifierLabel,
  });

  return NextResponse.json({ ...report, isDev });
}
