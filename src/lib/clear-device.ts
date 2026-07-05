// この端末の紐付けをクリアして脱出する処理。
// 旧 HamburgerMenu.handleClearDevice (88-104行) を関数として抽出したもの。
//   - サーバ: POST /api/session/clear が session_token を NULL 化 + wn_session cookie 削除
//   - クライアント: localStorage の紐付けキーを削除
//   - cookie クリア後の未診断状態でトップ LP を確実に出すためハード遷移
// 診断結果 (DB の users 行) は消さない。email / LINE で復元可能。
//
// ※ ボトムナビ導入で MENU を撤去したため、現在どのUIからも呼ばれていない。
//    将来トップページへ「この端末のデータを消す」導線を移設する際に再利用するため
//    ロジックだけ温存する (プロンプト指示)。window / localStorage を使うので
//    クライアント側からのみ呼ぶこと。
export async function clearDeviceSession(): Promise<void> {
  try {
    await fetch("/api/session/clear", { method: "POST" });
  } catch {
    // ネットワークエラーでもローカルだけは消して脱出を成立させる。
  }
  try {
    localStorage.removeItem("torisetsu_owner_token");
    localStorage.removeItem("torisetsu_invite_code");
    localStorage.removeItem("torisetsu_result");
  } catch {
    // localStorage 不可環境は無視。
  }
  window.location.href = "/";
}
