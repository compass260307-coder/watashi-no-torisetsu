let sessionId: string | null = null;

// セッションID (2026-07-13 改修):
//   旧実装は sessionStorage (タブ単位) で、同一ユーザーがタブ/アプリ内ブラウザを
//   またぐたびに別セッションになり「診断開始が過大・完了率が過小」に系統的に歪んでいた。
//   → localStorage + 30分スライディング有効期限 (GA と同じ「訪問」定義) に変更。
//   ストレージ不可の環境でも例外で計測全体が死なないよう、全体を try/catch し
//   メモリ内 fallback ID で送信は続ける (旧実装は例外で fetch まで届かなかった)。
const SESSION_KEY = "torisetsu_session_v2";
const SESSION_TTL_MS = 30 * 60 * 1000;

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // insecure context 等で crypto.randomUUID が無い環境の保険
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function getSessionId(): string {
  const now = Date.now();
  try {
    if (!sessionId) {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string; t?: number };
        if (
          typeof parsed.id === "string" &&
          typeof parsed.t === "number" &&
          now - parsed.t < SESSION_TTL_MS
        ) {
          sessionId = parsed.id;
        }
      }
    }
    if (!sessionId) sessionId = newId();
    // スライディング更新 (最後の活動から30分でセッション切れ)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: sessionId, t: now }));
    return sessionId;
  } catch {
    // ストレージ遮断環境: メモリ内IDで送信だけは続ける (イベント全欠落を防ぐ)
    if (!sessionId) sessionId = newId();
    return sessionId;
  }
}

export function isPreviewMode(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (sessionStorage.getItem("torisetsu_preview") === "1") return true;
    if (new URLSearchParams(window.location.search).get("preview") === "true") {
      sessionStorage.setItem("torisetsu_preview", "1");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ===== 計測イベントの正規名カタログ (single source of truth) =====
// CLAUDE.md の KPI 規約名に統一する。新規イベントを足すときはまずここに追記し、
// admin/stats/route.ts の集計名と必ず一致させること。旧名は stats 側で暫定併合中。
//
//   top_viewed                  トップページ表示 (metadata.locale/page)
//   top_cta_clicked             トップ→診断 CTA (metadata.locale/destination)
//   diagnosis_started            自己診断の開始
//   diagnosis_question_answered  設問到達 (metadata.questionIndex) ※内部計測
//   diagnosis_completed          自己診断の完了 (metadata.typeId)
//   friend_landing_viewed        友達招待ページ到達 (inviteCode)
//   friend_answer_started        友達回答の開始            (旧 friend_v2_started)
//   friend_answer_scale_completed 友達スケール回答の完了   (旧 friend_v2_scale_completed) ※内部計測
//   friend_answer_completed      友達回答の完了            (旧 friend_v2_completed)
//   friend_to_diagnosis_clicked  友達→自分も診断 CTA       (旧 friend_v2_self_cta_clicked)
//   friend_to_diagnosis_invite_clicked 本人が回答済みの友達へ自己診断を案内
//   friend_invite_clicked        自分の結果から友達を招待  (旧 share_clicked kind:friend_invite)
//   share_clicked                拡散シェア (metadata.kind: character | brag)
//   result_viewed                結果(/me)の初回表示 (metadata.friendCount, ownerToken)
//   result_revisited             結果(/me)の再訪 (ownerToken)
//   three_friends_unlocked       友達3人達成 (ownerToken)
//   tako_nav_badge_shown         診断完了後「友達診断」未確認バッジ表示 (ownerToken)
//   tako_nav_badge_clicked       未確認バッジ付き「友達診断」タップ (ownerToken)
//   tako_viewed                  本人の友達診断ページ (/tako/[token]) 到達 (ownerToken)
//
// ----- 課金ファネル (2026-07-13 追加) -----
//   paywall_viewed               課金カードの表示到達 (metadata.page/variant, ownerToken)
//   paywall_scroll_clicked       課金カードへの誘導クリック (metadata.source/page)
//   purchase_cta_clicked         購入CTAクリック=checkout要求 (metadata.page/source, ownerToken)
//   checkout_session_created     Stripe Checkout 作成 ※サーバ発行 (metadata.source/guest)
//   purchase_completed           決済完了 ※サーバ発行 (metadata.source)・stripe_session_id で冪等
//
// ⚠️ 旧名 friend_v2_* / share_clicked(kind:friend_invite) は既存 DB 行に残るため、
//    stats 側は当面 .in([新, 旧]) で両方集計する。
export function track(
  eventName: string,
  params?: {
    inviteCode?: string | null;
    ownerToken?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  if (isPreviewMode()) return;

  const locale =
    typeof window !== "undefined" && window.location.pathname.startsWith("/ko")
      ? "ko"
      : "ja";
  const localizedMetadata = {
    ...(params?.metadata ?? {}),
    locale,
  };

  // GA4 へ同じイベントを転送 (gtag.js が読めている本番のみ)。Supabase 集計と二重化するが、
  // GA 側でもコンバージョン計測できるようにする。gtag が無い環境 (dev/未設定) では無害にスキップ。
  try {
    const w = window as unknown as {
      gtag?: (command: string, name: string, params?: Record<string, unknown>) => void;
    };
    if (typeof w.gtag === "function") {
      w.gtag("event", eventName, {
        invite_code: params?.inviteCode ?? undefined,
        owner_token: params?.ownerToken ?? undefined,
        ...localizedMetadata,
      });
    }
  } catch {
    // GA 転送失敗は無視 (Supabase 側が主計測)
  }

  try {
    fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        sessionId: getSessionId(),
        inviteCode: params?.inviteCode ?? null,
        ownerToken: params?.ownerToken ?? null,
        locale,
        metadata: localizedMetadata,
      }),
    }).catch(() => {});
  } catch {
    // tracking never blocks UX
  }
}
