/** Tell the server a preset file was saved (admin funnel). Never blocks or throws. */
export function trackDownload() {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ kind: "download" });
  try {
    if (navigator.sendBeacon?.("/api/event", new Blob([body], { type: "text/plain" }))) return;
  } catch {
    /* fall through */
  }
  void fetch("/api/event", { method: "POST", body, keepalive: true, credentials: "same-origin" }).catch(() => undefined);
}
