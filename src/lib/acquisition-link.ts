// 共有/招待リンクに流入元 (ref) を付与するヘルパー。
// app/layout.tsx の acquisition capture スクリプトが URL の ?ref (または ?utm_source) を
// first-touch で拾い、診断完了時に users.acquisition_source に保存する。
// これにより「どの経路 (line / x / copy / qr …) から来た人か」が埋まる。
//
// 例: withRef("https://www.watashi-torisetsu.com/friend/abc", "line")
//     → "https://www.watashi-torisetsu.com/friend/abc?ref=line"

export function withRef(url: string, ref: string): string {
  try {
    // 共有リンクは基本 SITE_URL 起点の絶対 URL。相対でも壊れないよう base を渡す。
    const isAbsolute = /^https?:\/\//.test(url);
    const u = new URL(url, "https://placeholder.invalid");
    u.searchParams.set("ref", ref);
    return isAbsolute ? u.toString() : u.pathname + u.search + u.hash;
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}ref=${encodeURIComponent(ref)}`;
  }
}
