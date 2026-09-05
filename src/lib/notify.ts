import { toast } from "sonner";
import type { ResearchErr } from "./research";

export function notifyResearchError(
  err: ResearchErr,
  go: { login: () => void; upgrade: () => void },
) {
  if (err.reason === "signin") {
    toast.error(err.error, { action: { label: "Sign in", onClick: go.login }, duration: 8000 });
    return;
  }
  if (err.reason === "paywall" || err.reason === "quota") {
    toast.error(err.error, { action: { label: "Unlock", onClick: go.upgrade }, duration: 8000 });
    return;
  }
  const raw = err.error || "Research failed";
  const error = /self-signed|certificate|unable_to_verify/i.test(raw)
    ? "Could not reach research. Try a demo, then try again in a minute."
    : raw;
  toast.error(error);
}

export function notifyResearchSource(source: "library" | "cache" | "gemini" | "local") {
  if (source === "library") toast.success("Loaded a built-in demo. Ready to copy onto the Stomp.");
  else if (source === "local") toast.success("Matched from the HX catalog.");
  else toast.success("Researched and saved.");
}
