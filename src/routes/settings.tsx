import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { testGeminiKey } from "@/lib/gemini";
import { useAppStore } from "@/store/app-store";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const stored = useAppStore((s) => s.geminiKey);
  const hydrated = useAppStore((s) => s.hydrated);
  const hydrate = useAppStore((s) => s.hydrate);
  const setGeminiKey = useAppStore((s) => s.setGeminiKey);
  const [draft, setDraft] = useState(stored);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated) setDraft(stored);
  }, [hydrated, stored]);

  function save(next: string) {
    setGeminiKey(next);
    setDraft(next);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const key = draft.trim();
    if (!key) {
      save("");
      toast.success("Gemini key removed from this browser.");
      return;
    }
    save(key);
    setBusy(true);
    try {
      const result = await testGeminiKey(key);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Key works. Gemini Flash is ready for new songs.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Stomp Lab is a website anyone can use. Song research runs on{" "}
          <strong className="font-medium text-foreground">your</strong> free Google Gemini key.
          Built-in rigs and songs other people already looked up need no key at all.
        </p>
      </header>

      <form onSubmit={onSave} className="space-y-3 rounded-xl border border-border bg-card p-5">
        <Label htmlFor="gemini">Google Gemini API key</Label>
        <Input
          id="gemini"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="AIza…"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {draft.trim() ? (busy ? "Testing" : "Save & test") : "Remove key"}
          </Button>
          {stored ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                save("");
                toast.success("Gemini key removed from this browser.");
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Stored only in this browser — never written to the shared library. Research uses
          Gemini 3.7 Flash (free-tier). Create the key with <strong className="font-medium text-foreground">no application restriction</strong>{" "}
          (do not lock it to an HTTP referrer). The key is sent to this site only to call Google; it is
          not saved on the server.
        </p>
      </form>

      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-display text-lg font-semibold text-foreground">Get a free key</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Open{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
            >
              Google AI Studio
              <ExternalLink className="size-3" />
            </a>{" "}
            and sign in with a Google account.
          </li>
          <li>
            Create an API key. Leave application restrictions off — a referrer-locked key fails from
            this site. The free Gemini Flash quota is enough for song research.
          </li>
          <li>Paste it above and hit Save & test. Featured songs work even without a key.</li>
        </ol>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-display text-lg font-semibold text-foreground">How sharing works</h2>
        <p>
          Anyone can open this site. Featured songs (Teen Spirit, Sandman, YYZ…) load instantly.
          The first person to research a new song with their Gemini key stores the public preset —
          song, artist, and HX path only — in a shared library. The next visitor gets that rig with
          no API call. Your locker, history, and API key stay on your device.
        </p>
        <p>
          Download a .hlx from any preset and import it in HX Edit (File → Import). Research never
          uses a second AI provider — only the Gemini key you paste above.
        </p>
        <p>
          <Link to="/" className="text-primary underline underline-offset-2">
            Back to the Lab
          </Link>
        </p>
      </section>
    </div>
  );
}
