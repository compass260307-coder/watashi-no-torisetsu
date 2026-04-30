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

export function track(
  eventName: string,
  params?: {
    inviteCode?: string | null;
    ownerToken?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
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
