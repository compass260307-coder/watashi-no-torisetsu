import { supabase } from "@/lib/supabase";
import {
  buildReportData,
  REPORT_FRIEND_THRESHOLD,
  type FriendAnswerRecord,
} from "@/lib/report-data";
import type { BigFiveDimension, TorisetsuTypeId } from "@/lib/types";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import { friendQuestions } from "@/lib/friend-questions";
import { NextRequest, NextResponse } from "next/server";

const VALID_TYPE_IDS = new Set<string>(Object.keys(torisetsuTypes));

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function jitter(value: number): number {
  // ±1 の差分を加え、1〜4の範囲にクランプ。レーダーが見える程度の自然なズレを作る。
  const offset = (Math.random() * 2 - 1) * 1.0;
  return Math.round(clamp(value + offset, 1, 4));
}

// Q5, Q9 は C/N 軸スコアの元になるため、極端な選択肢のみから50/50で選び
// dev モードで N/C 軸が中央値に収束する問題を回避する
const Q5_BIASED_CHOICES = ["実はめっちゃ繊細", "実はめっちゃ頼りになる"];
const Q9_BIASED_CHOICES = [
  "マイペースだけど丁寧",
  "気分が乗った時にバーッと返してくる",
];

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function generateDummyFriendAnswer(
  selfScores: Record<BigFiveDimension, number>,
): FriendAnswerRecord {
  // E/A/O: 自己評価±1の範囲で数値生成
  const answers: Record<string, string | number> = {
    "1": jitter(selfScores.E),
    "2": jitter(selfScores.A),
    "3": jitter(selfScores.O),
  };

  // Q4〜Q10 (choice 型) のダミー生成
  for (const q of friendQuestions) {
    if (q.type !== "choice" || !q.choices || q.choices.length === 0) continue;

    if (q.id === 5) {
      answers["5"] = pickRandom(Q5_BIASED_CHOICES);
    } else if (q.id === 9) {
      answers["9"] = pickRandom(Q9_BIASED_CHOICES);
    } else {
      answers[String(q.id)] = pickRandom(q.choices);
    }
  }

  return {
    answers,
    created_at: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const isDevRequested = request.nextUrl.searchParams.get("dev") === "true";
  const requestAdminKey = request.nextUrl.searchParams.get("adminKey");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
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

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, type_id, scores, owner_token")
    .eq("owner_token", token)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: friendAnswers } = await supabase
    .from("friend_answers")
    .select("answers, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const selfScores = user.scores as Record<BigFiveDimension, number>;
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
    typeId: forceType ?? (user.type_id as TorisetsuTypeId),
    selfScores,
    friendAnswers: answersForReport,
  });

  return NextResponse.json({ ...report, isDev });
}
