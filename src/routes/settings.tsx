import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { testGeminiKey } from "@/lib/gemini";
import type { FsModePref, ThemeId } from "@/lib/storage";
import { useAppStore } from "@/store/app-store";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const stored = useAppStore((s) => s.geminiKey);
  const hydrated = useAppStore((s) => s.hydrated);
  const hydrate = useAppStore((s) => s.hydrate);
  const setGeminiKey = useAppStore((s) => s.setGeminiKey);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const defaultFsMode = useAppStore((s) => s.defaultFsMode);
  const setDefaultFsMode = useAppStore((s) => s.setDefaultFsMode);
  const showDsp = useAppStore((s) => s.showDsp);
  const setShowDsp = useAppStore((s) => s.setShowDsp);
  const confirmDownload = useAppStore((s) => s.confirmDownload);
  const setConfirmDownload = useAppStore((s) => s.setConfirmDownload);
  const instrument = useAppStore((s) => s.instrument);
  const setInstrument = useAppStore((s) => s.setInstrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const setStompModel = useAppStore((s) => s.setStompModel);
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

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Look and feel</h2>
        <fieldset className="space-y-2">
          <Label>Theme</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["dark", "Dark"],
                ["light", "Light"],
                ["system", "Match device"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id satisfies ThemeId)}
                className={`h-10 rounded-full px-4 text-sm ${
                  theme === id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <Label>Default instrument</Label>
          <div className="flex flex-wrap gap-2">
            {(["guitar", "bass"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setInstrument(id)}
                className={`h-10 rounded-full px-4 text-sm capitalize ${
                  instrument === id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <Label>Default unit</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["hx-stomp", "HX Stomp"],
                ["hx-stomp-xl", "HX Stomp XL"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStompModel(id)}
                className={`h-10 rounded-full px-4 text-sm ${
                  stompModel === id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <Label>When a rig opens, start in</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["auto", "Auto (match the song)"],
                ["snapshot", "Snapshot mode"],
                ["stomp", "Stomp mode"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDefaultFsMode(id satisfies FsModePref)}
                className={`h-10 rounded-full px-4 text-sm ${
                  defaultFsMode === id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-primary"
            checked={showDsp}
            onChange={(e) => setShowDsp(e.target.checked)}
          />
          <span>
            Show DSP load on the replica
            <span className="mt-0.5 block text-xs text-muted-foreground">
              The percentage in the corner of the Line 6 display.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-primary"
            checked={confirmDownload}
            onChange={(e) => setConfirmDownload(e.target.checked)}
          />
          <span>
            Confirm before downloading a .hlx
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Extra tap so a misclick doesn't save a file.
            </span>
          </span>
        </label>
      </section>

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
          Gemini Flash (2.5 first — the free-tier workhorse — then 3.x if needed). Create the key with{" "}
          <strong className="font-medium text-foreground">no application restriction</strong> (do not lock it to an
          HTTP referrer). The key is sent to this site only to call Google; it is not saved on the server.
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
            Create an API key. Leave application restrictions off — a referrer-locked key fails from this site. The
            free Gemini Flash quota is enough for song research.
          </li>
          <li>Paste it above and hit Save & test. Featured songs work even without a key.</li>
        </ol>
      </section>

      <section id="troubleshoot" className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">If something isn't working</h2>
        <details className="group border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Gemini says the key is invalid</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a new key in Google AI Studio with <strong className="text-foreground">no application restriction</strong>.
            Do not lock it to an HTTP referrer, and don't use a Vertex/Cloud key. Paste the whole key — it starts with AIza.
          </p>
        </details>
        <details className="border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            "Too many users" / Gemini is busy
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Google's free Flash models get crowded. Wait a minute and try again. Featured songs (Teen Spirit, Sandman,
            YYZ…) never need a key — open those while you wait.
          </p>
        </details>
        <details className="border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">HX Edit doesn't recognize the preset</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            In HX Edit use File → Import, not drag-and-drop onto a setlist. Firmware 3.80 or newer. After import, press
            PAGE on the unit until the scribble strips match Snapshot or Stomp — the file itself doesn't switch that
            hardware mode.
          </p>
        </details>
        <details className="border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Snapshots don't change the sound</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            On this site, tap Snapshot above the replica. On the real Stomp, PAGE until the display says SNAP. FS1–FS3
            then recall verse/chorus/solo. Stomp mode only toggles individual effects.
          </p>
        </details>
        <details className="border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">The same song researched twice</summary>
          <p className="mt-2 text-muted-foreground text-sm">
            The first successful lookup is stored in the shared library (song, artist, path — never your key). Repeats
            skip Gemini. Featured songs always load from the built-in library.
          </p>
        </details>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Home screen says Grok App
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Remove the old icon, then add this site to your home screen again. The install name is StompLab and the
            icon is the LCD-and-switch mark.
          </p>
        </details>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-display text-lg font-semibold text-foreground">How sharing works</h2>
        <p>
          Anyone can open this site. Featured songs (Teen Spirit, Sandman, YYZ…) load instantly. The first person to
          research a new song with their Gemini key stores the public preset — song, artist, and HX path only — in a
          shared library. The next visitor gets that rig with no API call. Your locker, history, and API key stay on
          your device.
        </p>
        <p>
          Download a .hlx from any preset and import it in HX Edit (File → Import). Research never uses a second AI
          provider — only the Gemini key you paste above.
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
