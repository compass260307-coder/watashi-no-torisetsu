/** Serial polling while the page is visible. Return false to finish permanently,
 * or the delay until the next attempt. A visible tab resumes immediately.
 * Callers must check signal.aborted after awaits before changing UI/navigation.
 */
export function startVisiblePolling(
  poll: (signal: AbortSignal) => Promise<number | false>,
  initialDelay = 0,
): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;

  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function stop() {
    controller.abort();
    clearTimer();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  function schedule(delay: number) {
    clearTimer();
    if (!controller.signal.aborted && !document.hidden) {
      timer = setTimeout(() => void run(), delay);
    }
  }

  async function run() {
    timer = undefined;
    if (controller.signal.aborted || document.hidden || running) return;
    running = true;
    try {
      const delay = await poll(controller.signal);
      if (controller.signal.aborted) return;
      if (delay === false) stop();
      else schedule(delay);
    } catch {
      // Callers handle recoverable errors and choose a bounded retry delay.
      // Unexpected exceptions must not leave an unhandled rejection or loop.
      stop();
    } finally {
      running = false;
    }
  }

  function onVisibilityChange() {
    clearTimer();
    if (!document.hidden && !running) schedule(0);
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  schedule(initialDelay);
  return stop;
}

/** Authentication/missing-resource failures cannot recover by repeated polling. */
export function isTerminalPollResponse(response: Response): boolean {
  return [400, 401, 403, 404, 409, 410, 422].includes(response.status);
}
