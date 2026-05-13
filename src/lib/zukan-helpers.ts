import { TYPE_TO_BASE_CODE } from "./diagnosis";
import { torisetsuTypes } from "./torisetsu-data";
import type {
  CModifier,
  NModifier,
  TorisetsuTypeId,
} from "./types";

export interface ZukanEntry {
  typeId: TorisetsuTypeId;
  baseCode: string;       // "EAO" 等
  cModifier: CModifier;
  nModifier: NModifier;
  fullCode: string;       // "EAO-C-N" 等
  shortName: string;      // "お祭り系" 等
  color: string;          // タイプ色
}

const C_MODS: readonly CModifier[] = ["C", "F"];
const N_MODS: readonly NModifier[] = ["N", "R"];

/**
 * 8 タイプ × 2 (C/F) × 2 (N/R) = 32 サブパターンの全エントリを生成する。
 * 並び順: typeId の自然順、各タイプ内は C-N → C-R → F-N → F-R。
 */
export function generateAllZukanEntries(): ZukanEntry[] {
  const entries: ZukanEntry[] = [];
  for (const type of Object.values(torisetsuTypes)) {
    const baseCode = TYPE_TO_BASE_CODE[type.id];
    for (const c of C_MODS) {
      for (const n of N_MODS) {
        entries.push({
          typeId: type.id,
          baseCode,
          cModifier: c,
          nModifier: n,
          fullCode: `${baseCode}-${c}-${n}`,
          shortName: type.shortName,
          color: type.color,
        });
      }
    }
  }
  return entries;
}
