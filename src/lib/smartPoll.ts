/** Runs `fn` immediately, then every `intervalMs` while the page is visible.
 * Pauses in background tabs (saves battery + server invocations) and fires
 * again the instant the tab regains focus or becomes visible, so data feels
 * live without burning requests while nobody is looking.
 * Returns a cleanup function. */
export function smartPoll(fn: () => void, intervalMs: number): () => void {
  fn();
  const tick = (): void => {
    if (typeof document !== "undefined" && document.hidden) return;
    fn();
  };
  const timer = setInterval(tick, intervalMs);
  const kick = (): void => {
    // Only refresh when coming back into view; visibilitychange also fires
    // when hiding, which we ignore.
    if (typeof document !== "undefined" && document.hidden) return;
    fn();
  };
  window.addEventListener("focus", kick);
  document.addEventListener("visibilitychange", kick);
  return () => {
    clearInterval(timer);
    window.removeEventListener("focus", kick);
    document.removeEventListener("visibilitychange", kick);
  };
}
