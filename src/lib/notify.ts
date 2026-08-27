import { toast } from "sonner";
import type { ResearchErr } from "./research";

export function notifyResearchError(err: ResearchErr, goSettings: () => void) {
  if (err.needKey) {
    toast.error(err.error, {
      action: { label: "Add key", onClick: goSettings },
      duration: 9000,
    });
    return;
  }
  toast.error(err.error);
}

export function notifyResearchSource(source: "library" | "cache" | "gemini" | "local") {
  if (source === "library") toast.success("Loaded from the built-in library. No API used.");
  else if (source === "cache") toast.success("Already in the shared library. No API used.");
  else if (source === "local") toast.success("Matched from the HX catalog.");
  else toast.success("Researched with your Gemini key and saved for everyone.");
}
