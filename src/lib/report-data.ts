import type { BigFiveDimension, TorisetsuTypeId } from "./types";
import { computeGapAnalysis, type GapItem } from "./gap-analysis";
import { torisetsuTypes } from "./torisetsu-data";

export const REPORT_FRIEND_THRESHOLD = 3;

export type FriendAnswerRecord = {
  answers: Record<string, string | number>;
  created_at?: string;
};

export type ShortBigFive = Partial<Record<BigFiveDimension, number>>;

export interface RelationshipMatrix {
  closestType: TorisetsuTypeId | null;
  farthestType: TorisetsuTypeId | null;
  bestPartnerType: TorisetsuTypeId | null;
}

export interface ReportData {
  ownerToken: string;
  typeId: TorisetsuTypeId;
  typeName: string;
  typeColor: string;
  typeEmoji: string;
  typeImageUrl: string | null;
  typeSubtitle: string;
  typeCatchCopy: string;
  selfBigFive: ShortBigFive;
  friendBigFive: ShortBigFive;
  gaps: GapItem[];
  topGaps: GapItem[];
  friendCount: number;
  meetsThreshold: boolean;
  relationship: RelationshipMatrix;
  isDev?: boolean;
}

const TYPE_CATCH_COPY: Record<TorisetsuTypeId, string> = {
  "festival-sun": "みんなを巻き込む、明るい主役",
  "everyones-home": "そこにいるだけで安心の存在",
  "wild-charisma": "周りを巻き込んで進む、自分の道",
  "iron-mental": "ブレない、揺るがない、信頼の人",
  "delicate-creator": "感性で世界を編み直す人",
  "healing-guardian": "静かに支え、誰かを癒す人",
  "deep-dive-explorer": "好きを掘り下げる職人気質",
  "cool-maverick": "クールな視点で物事を見る人",
};

const RELATIONSHIPS: Partial<
  Record<
    TorisetsuTypeId,
    {
      closest: TorisetsuTypeId;
      farthest: TorisetsuTypeId;
      bestPartner: TorisetsuTypeId;
    }
  >
> = {
  "festival-sun": {
    closest: "wild-charisma",
    farthest: "cool-maverick",
    bestPartner: "everyones-home",
  },
};

function calculateFriendAverages(
  friendAnswers: FriendAnswerRecord[],
): ShortBigFive {
  const map: Record<string, BigFiveDimension> = {
    "1": "E",
    "2": "A",
    "3": "O",
  };
  const buckets: Partial<Record<BigFiveDimension, number[]>> = {};

  for (const fa of friendAnswers) {
    for (const [qid, dim] of Object.entries(map)) {
      const v = fa.answers[qid];
      if (typeof v === "number") {
        (buckets[dim] ??= []).push(v);
      }
    }
  }

  const out: ShortBigFive = {};
  for (const dim of ["E", "A", "O"] as BigFiveDimension[]) {
    const values = buckets[dim];
    if (values && values.length > 0) {
      out[dim] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }
  return out;
}

export function buildReportData(input: {
  ownerToken: string;
  typeId: TorisetsuTypeId;
  selfScores: Record<BigFiveDimension, number>;
  friendAnswers: FriendAnswerRecord[];
}): ReportData {
  const { ownerToken, typeId, selfScores, friendAnswers } = input;
  const meta = torisetsuTypes[typeId];
  const friendBigFive = calculateFriendAverages(friendAnswers);
  const gaps = computeGapAnalysis(selfScores, friendAnswers);
  const topGaps = [...gaps]
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);

  const r = RELATIONSHIPS[typeId];

  return {
    ownerToken,
    typeId,
    typeName: meta.name,
    typeColor: meta.color,
    typeEmoji: meta.emoji,
    typeImageUrl: meta.imageUrl ?? null,
    typeSubtitle: meta.subtitle,
    typeCatchCopy: TYPE_CATCH_COPY[typeId] ?? meta.subtitle,
    selfBigFive: selfScores,
    friendBigFive,
    gaps,
    topGaps,
    friendCount: friendAnswers.length,
    meetsThreshold: friendAnswers.length >= REPORT_FRIEND_THRESHOLD,
    relationship: {
      closestType: r?.closest ?? null,
      farthestType: r?.farthest ?? null,
      bestPartnerType: r?.bestPartner ?? null,
    },
  };
}
