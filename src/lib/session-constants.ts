export const SESSION_COOKIE_NAME = "wn_session";

// HttpOnly の session cookie 自体はクライアントから読めないため、トップで
// session 解決 API を呼ぶ必要がある端末だけを識別する非機密マーカー。
// 値に認証情報は含めず、認可は必ず SESSION_COOKIE_NAME 側で行う。
export const SESSION_MARKER_COOKIE_NAME = "wn_session_present";

// 認証情報を含まない世代識別子。ログイン/セッション再発行時の表示キャッシュ破棄用。
export const SESSION_ACCESS_CACHE_COOKIE_NAME = "wn_access_cache_scope";
