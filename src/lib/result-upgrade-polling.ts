import { isTerminalPollResponse, startVisiblePolling } from "./visible-polling";

export type ResultUpgradeSpendPauseStatus = {
  retryAt?: string | null;
  canRetry?: boolean;
};

/** One generation kick per mount/manual retry, followed by bounded status reads. */
export function watchResultUpgrade({
  force,
  onReady,
  onFailed,
  onBlocked,
  checkBeforeKick = false,
}: {
  force: boolean;
  onReady: () => void;
  onFailed: () => void;
  onBlocked?: (status: ResultUpgradeSpendPauseStatus) => void;
  checkBeforeKick?: boolean;
}): () => void {
  let kicked = false;
  let failures = 0;
  let delay = 2_000;
  let deadline = 0;
  let retryGraceUntil = 0;
  const blocked = (status: ResultUpgradeSpendPauseStatus) => {
    if (onBlocked) onBlocked(status);
    else onFailed();
  };

  return startVisiblePolling(async (signal) => {
    if (!kicked) {
      if (!deadline) deadline = Date.now() + 5 * 60_000;
      if (checkBeforeKick) {
        try {
          const response = await fetch("/api/result-upgrade/status", { cache: "no-store", signal });
          if (signal.aborted) return false;
          if (isTerminalPollResponse(response)) { onFailed(); return false; }
          if (!response.ok) throw new Error("Status unavailable");
          const data = (await response.json()) as ResultUpgradeSpendPauseStatus & { state?: string };
          if (signal.aborted) return false;
          if (data.state === "ready") { onReady(); return false; }
          if (data.state === "blocked" && (!force || !data.canRetry)) {
            blocked(data);
            return false;
          }
          if ((data.state === "failed" && !force) ||
              ["no_answers", "locked", "unpurchased"].includes(data.state ?? "")) {
            onFailed();
            return false;
          }
          failures = 0;
        } catch {
          if (signal.aborted) return false;
          failures += 1;
          if (failures >= 5 || Date.now() >= deadline) { onFailed(); return false; }
          return 2_000;
        }
      }
      kicked = true;
      try {
        const response = await fetch("/api/result-upgrade/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
          signal,
        });
        if (signal.aborted) return false;
        if (isTerminalPollResponse(response) || response.status === 429) {
          onFailed();
          return false;
        }
        if (response.ok) {
          const data = (await response.json()) as ResultUpgradeSpendPauseStatus & { state?: string };
          if (signal.aborted) return false;
          if (data.state === "blocked") { blocked(data); return false; }
          if (data.state === "ready") { onReady(); return false; }
          if (data.state === "failed") { onFailed(); return false; }
          if (force) retryGraceUntil = Date.now() + 10_000;
        }
      } catch {
        // The request may have reached the server. Check status rather than
        // submitting another generation request after an ambiguous failure.
      }
    }
    if (signal.aborted) return false;
    if (document.hidden) return 0;

    try {
      const response = await fetch("/api/result-upgrade/status", {
        cache: "no-store",
        signal,
      });
      if (signal.aborted) return false;
      if (isTerminalPollResponse(response)) {
        onFailed();
        return false;
      }
      if (!response.ok) throw new Error("Status unavailable");
      const data = (await response.json()) as ResultUpgradeSpendPauseStatus & { state?: string };
      if (signal.aborted) return false;
      failures = 0;
      if (data.state === "generating" || data.state === "pending") retryGraceUntil = 0;
      if (data.state === "ready") {
        onReady();
        return false;
      }
      if (data.state === "blocked" && Date.now() >= retryGraceUntil) {
        blocked(data);
        return false;
      }
      // after() may not have replaced the previous failed row yet after a
      // manual retry was accepted. Give that transition a bounded grace period.
      if ((data.state === "failed" && Date.now() >= retryGraceUntil) ||
          ["no_answers", "locked", "unpurchased"].includes(data.state ?? "")) {
        onFailed();
        return false;
      }
    } catch {
      if (signal.aborted) return false;
      failures += 1;
    }
    if (failures >= 5 || Date.now() >= deadline) {
      onFailed();
      return false;
    }
    const nextDelay = delay;
    delay = Math.min(Math.round(delay * 1.4), 8_000);
    return nextDelay;
  });
}
