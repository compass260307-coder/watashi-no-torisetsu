// 本番サイトURLの解決。ユーザー向けの共有/OG URL はここ経由に統一する。
//
// ガード方針:
//   - 空文字 (未設定) は本番ドメインにフォールバック。
//   - vercel.app 値 (プレビュー既定エイリアス等) が env に入っていても、共有URLに漏れないよう
//     本番ドメインに矯正する。過去に NEXT_PUBLIC_SITE_URL が vercel.app を指し、評価依頼シェアの
//     URL が watashi-no-torisetsu.vercel.app になった事象の再発防止 (env設定と二重防御)。
//   - 末尾スラッシュは除去 (呼び出し側が /friend 等を付けるため二重化を防ぐ)。

const CANONICAL = "https://www.watashi-torisetsu.com";

export function resolveSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (!raw || raw.includes("vercel.app")) return CANONICAL;
  return raw.replace(/\/+$/, "");
}
