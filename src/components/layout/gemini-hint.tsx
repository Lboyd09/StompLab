import { Link } from "@tanstack/react-router";
import { useAppStore } from "@/store/app-store";

export function GeminiHint() {
  const key = useAppStore((s) => s.geminiKey);
  if (key.trim()) {
    return (
      <p className="text-xs text-muted-foreground">
        New songs use Gemini Flash with the key in this browser. Repeats load from the shared
        library — no extra API call.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      Built-in rigs and the shared library work with no key.{" "}
      <Link to="/settings" className="text-primary underline underline-offset-2">
        Add a free Gemini key
      </Link>{" "}
      only when you research something new.
    </p>
  );
}
