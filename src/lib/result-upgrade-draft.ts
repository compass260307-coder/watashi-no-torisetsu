const PREFIX = "result-upgrade-draft-v1:";
const MAX_AGE_MS = 60 * 60 * 1000;

type Draft = { answers: string[]; draft: string };

// Tab-scoped, result-specific recovery. Read only after the owner's session is verified.
export function loadResultUpgradeDraft(ownerToken: string): Draft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PREFIX + ownerToken) ?? "null");
    if (!value) return null;
    if (typeof value.savedAt !== "number" || Date.now() - value.savedAt > MAX_AGE_MS ||
        !Array.isArray(value.answers) || value.answers.length > 4 ||
        !value.answers.every((answer: unknown) => typeof answer === "string" && answer.trim().length > 0 && answer.length <= 500) ||
        typeof value.draft !== "string" || value.draft.length > 500) {
      clearResultUpgradeDraft(ownerToken);
      return null;
    }
    return { answers: value.answers, draft: value.draft };
  } catch {
    return null;
  }
}

export function saveResultUpgradeDraft(ownerToken: string, answers: string[], draft: string): void {
  try {
    if (answers.length === 0 && !draft) return;
    sessionStorage.setItem(PREFIX + ownerToken, JSON.stringify({
      answers: answers.slice(0, 4), draft: answers[4] ?? draft, savedAt: Date.now(),
    }));
  } catch {
    // Storage may be unavailable; the mounted chat still retains its answers.
  }
}

export function clearResultUpgradeDraft(ownerToken: string): void {
  try { sessionStorage.removeItem(PREFIX + ownerToken); } catch { /* optional storage */ }
}
