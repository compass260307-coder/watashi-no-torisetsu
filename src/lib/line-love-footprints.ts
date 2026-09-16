export const LINE_LOVE_FOOTPRINT_KINDS = [
  { value: "meeting", label: "出会い", icon: "✦" },
  { value: "happy", label: "うれしかった", icon: "♡" },
  { value: "worry", label: "迷った", icon: "☁" },
  { value: "turning_point", label: "恋の転機", icon: "☽" },
  { value: "goodbye", label: "お別れ", icon: "◇" },
  { value: "other", label: "その他", icon: "·" },
] as const;

export const LINE_LOVE_FOOTPRINT_MOODS = [
  { value: "flutter", label: "きゅん" },
  { value: "happy", label: "しあわせ" },
  { value: "calm", label: "安心" },
  { value: "uncertain", label: "もやもや" },
  { value: "sad", label: "かなしい" },
  { value: "hopeful", label: "前向き" },
] as const;

export type LineLoveFootprintKind =
  (typeof LINE_LOVE_FOOTPRINT_KINDS)[number]["value"];
export type LineLoveFootprintMood =
  (typeof LINE_LOVE_FOOTPRINT_MOODS)[number]["value"];

export interface LineLoveFootprint {
  id: string;
  happenedOn: string;
  partnerName: string | null;
  kind: LineLoveFootprintKind;
  mood: LineLoveFootprintMood;
  title: string;
  note: string | null;
  createdAt: string;
}

export function isLineLoveFootprintKind(
  value: unknown,
): value is LineLoveFootprintKind {
  return LINE_LOVE_FOOTPRINT_KINDS.some((item) => item.value === value);
}

export function isLineLoveFootprintMood(
  value: unknown,
): value is LineLoveFootprintMood {
  return LINE_LOVE_FOOTPRINT_MOODS.some((item) => item.value === value);
}

export function lineLoveFootprintFromRow(row: {
  id: string;
  happened_on: string;
  partner_name: string | null;
  kind: string;
  mood: string;
  title: string;
  note: string | null;
  created_at: string;
}): LineLoveFootprint | null {
  if (!isLineLoveFootprintKind(row.kind) || !isLineLoveFootprintMood(row.mood)) {
    return null;
  }
  return {
    id: row.id,
    happenedOn: row.happened_on,
    partnerName: row.partner_name,
    kind: row.kind,
    mood: row.mood,
    title: row.title,
    note: row.note,
    createdAt: row.created_at,
  };
}
