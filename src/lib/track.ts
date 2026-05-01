let sessionId: string | null = null;

function getSessionId(): string {
  if (sessionId) return sessionId;
  const stored = sessionStorage.getItem("torisetsu_session");
  if (stored) {
    sessionId = stored;
    return stored;
  }
  const id = crypto.randomUUID();
  sessionStorage.setItem("torisetsu_session", id);
  sessionId = id;
  return id;
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

export function track(
  eventName: string,
  params?: {
    inviteCode?: string | null;
    ownerToken?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  if (isPreviewMode()) return;
  try {
    fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        sessionId: getSessionId(),
        inviteCode: params?.inviteCode ?? null,
        ownerToken: params?.ownerToken ?? null,
        metadata: params?.metadata ?? {},
      }),
    }).catch(() => {});
  } catch {
    // tracking never blocks UX
  }
}
