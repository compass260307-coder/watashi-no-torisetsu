import "server-only";

import { hashLineLinkCode } from "@/lib/line";
import {
  isResultUpgradeReady,
} from "@/lib/result-upgrade";
import { loadResultUpgradeForUser } from "@/lib/result-upgrade-server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  classifyThirtyTwoType,
  thirtyTwoName,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

export type LineLinkCodeKind = "liff" | "manual";
export type LineLinkSource = LineLinkCodeKind;
export type LineLinkResultStatus =
  | "linked"
  | "already_linked"
  | "conflict"
  | "not_found"
  | "used"
  | "expired"
  | "error";

export type LineDiagnosisSummary = {
  diagnosedAt: string | null;
  typeName: string | null;
};

export type LineLinkedUser = LineDiagnosisSummary & {
  id: string;
  displayName: string | null;
  ownerToken: string | null;
  resultUpgraded: boolean;
};

export type ConsumeLineLinkCodeResult = {
  status: LineLinkResultStatus;
  user: LineLinkedUser | null;
  currentLink: LineDiagnosisSummary | null;
  switched: boolean;
};

type ConsumeRpcRow = {
  result_status?: string;
  linked_user_id?: string | null;
  previous_user_id?: string | null;
  switched?: boolean | null;
};

type UserRow = {
  id: string;
  display_name: string | null;
  owner_token: string | null;
  scores: unknown;
  diagnosis_completed_at: string | null;
  created_at: string | null;
};

function normalizeScores(
  value: unknown,
): Partial<Record<BigFiveDimension, number>> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const scores: Partial<Record<BigFiveDimension, number>> = {};
  for (const dimension of ["E", "A", "O", "C", "N"] as const) {
    const score = source[dimension];
    if (typeof score === "number" && Number.isFinite(score)) {
      scores[dimension] = score;
    }
  }
  return Object.keys(scores).length > 0 ? scores : null;
}

async function toLinkedUser(row: UserRow): Promise<LineLinkedUser> {
  const scores = normalizeScores(row.scores);
  const resultUpgrade = await loadResultUpgradeForUser(row.id);
  let typeName: string | null = null;
  if (isResultUpgradeReady(resultUpgrade)) {
    typeName = resultUpgrade.personalized_type_name;
  } else if (scores) {
    try {
      typeName = thirtyTwoName(classifyThirtyTwoType(scores));
    } catch {
      typeName = null;
    }
  }
  return {
    id: row.id,
    displayName: row.display_name?.trim() || null,
    ownerToken: row.owner_token,
    diagnosedAt: row.diagnosis_completed_at ?? row.created_at,
    typeName,
    resultUpgraded: isResultUpgradeReady(resultUpgrade),
  };
}

async function getLinkedUser(userId: string | null): Promise<LineLinkedUser | null> {
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, display_name, owner_token, scores, diagnosis_completed_at, created_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) {
    if (error) {
      console.error("[line-linking] linked user lookup failed", {
        message: error.message,
      });
    }
    return null;
  }
  return toLinkedUser(data as UserRow);
}

export async function consumeLineLinkCode(input: {
  code: string;
  kind: LineLinkCodeKind;
  lineUserId: string;
  force?: boolean;
  source: LineLinkSource;
}): Promise<ConsumeLineLinkCodeResult> {
  const { data, error } = await supabaseAdmin.rpc("consume_line_link_code", {
    p_code_hash: hashLineLinkCode(input.code),
    p_kind: input.kind,
    p_line_user_id: input.lineUserId,
    p_force: input.force === true,
    p_source: input.source,
  });
  if (error) {
    console.error("[line-linking] consume RPC failed", {
      kind: input.kind,
      message: error.message,
    });
    return { status: "error", user: null, currentLink: null, switched: false };
  }

  const row = (Array.isArray(data) ? data[0] : data) as ConsumeRpcRow | null;
  const knownStatuses: LineLinkResultStatus[] = [
    "linked",
    "already_linked",
    "conflict",
    "not_found",
    "used",
    "expired",
  ];
  const status = knownStatuses.includes(row?.result_status as LineLinkResultStatus)
    ? (row?.result_status as LineLinkResultStatus)
    : "error";
  const shouldReadLinkedUser =
    status === "linked" || status === "already_linked" || status === "conflict";
  const [user, previousUser] = await Promise.all([
    shouldReadLinkedUser
      ? getLinkedUser(row?.linked_user_id ?? null)
      : Promise.resolve(null),
    status === "conflict"
      ? getLinkedUser(row?.previous_user_id ?? null)
      : Promise.resolve(null),
  ]);

  return {
    status,
    user,
    currentLink: previousUser
      ? {
          diagnosedAt: previousUser.diagnosedAt,
          typeName: previousUser.typeName,
        }
      : null,
    switched: row?.switched === true,
  };
}

export function lineLinkSuccessMessage(input: {
  displayName: string | null;
  personalizedTypeName?: string | null;
  resultUpgraded?: boolean;
  switched: boolean;
  chatEnabled: boolean;
}): string {
  const firstLine = input.switched
    ? "連携先を新しい診断結果に切り替えました。"
    : input.resultUpgraded && input.personalizedTypeName
      ? `連携できました。${input.displayName ? `${input.displayName}さん` : "あなた"}専用の「${input.personalizedTypeName}」の鑑定結果、たしかに受け取りました。`
      : `連携できました。${input.displayName ? `${input.displayName}さん` : "あなた"}のトリセツ、たしかに受け取りました。`;
  return [
    firstLine,
    input.chatEnabled
      ? input.resultUpgraded
        ? "これからは、自由回答で話してくれたことや専用鑑定書も覚えたAliceとしてお話しします。恋愛相談やタロット、相性占いから気になるものを選んでみてくださいね。"
        : "これで、あなたに合わせてお話しできます。下の質問から、気になるものを選んでみてくださいね。"
      : "ここでお話しできる準備が整ったら、まっさきにお知らせしますね。",
  ].join("\n");
}
