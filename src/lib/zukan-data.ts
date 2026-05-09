import type { TorisetsuTypeId } from "./types";

export type ZukanTypeEntry = {
  typeId: TorisetsuTypeId;
  name: string;
  emoji: string;
  imageUrl: string | null;
  color: string;
  subtitle: string;
  count: number; // この owner から派生した (source_user_id = owner.id) このタイプの友達の数
  isSelf: boolean; // owner 自身のタイプか
  unlocked: boolean; // count > 0 || isSelf
};

export type ZukanData = {
  ownerToken: string;
  selfTypeId: TorisetsuTypeId;
  totalTypes: number;
  unlockedCount: number;
  entries: ZukanTypeEntry[];
};
