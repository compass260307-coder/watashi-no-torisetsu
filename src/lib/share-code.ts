// Phase 1.5-α: シェアコード生成。
//
// ユーザー id (or owner_token) から決定的に短いコード WTR-XXXX を生成する。
// 用途: SNS シェア用の保存画像に表示するのみ (今回はコード検索導線は作らない)。
// 決定的 = 同じ seed なら常に同じコード。FNV-1a ハッシュ → base36 大文字 4 桁。

export function generateShareCode(seed: string | null | undefined): string {
  const s = (seed ?? "").trim();
  if (!s) return "WTR-0000";
  let h = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  const code = (h >>> 0).toString(36).toUpperCase().padStart(4, "0").slice(-4);
  return `WTR-${code}`;
}
