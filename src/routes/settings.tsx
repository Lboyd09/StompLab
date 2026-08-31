import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { cacheHealth } from "@/lib/cache";
import { FREE_BUILDS, LAUNCH_USD, PAID_MONTHLY_BUILDS, PRICE_USD } from "@/lib/plan";
import type { FsModePref, ThemeId } from "@/lib/storage";
import { usePlan } from "@/lib/use-plan";
import { useAppStore } from "@/store/app-store";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const hydrate = useAppStore((s) => s.hydrate);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const defaultFsMode = useAppStore((s) => s.defaultFsMode);
  const setDefaultFsMode = useAppStore((s) => s.setDefaultFsMode);
  const showDsp = useAppStore((s) => s.showDsp);
  const setShowDsp = useAppStore((s) => s.setShowDsp);
  const showFsNumbers = useAppStore((s) => s.showFsNumbers);
  const setShowFsNumbers = useAppStore((s) => s.setShowFsNumbers);
  const largeControls = useAppStore((s) => s.largeControls);
  const setLargeControls = useAppStore((s) => s.setLargeControls);
  const lcdBright = useAppStore((s) => s.lcdBright);
  const setLcdBright = useAppStore((s) => s.setLcdBright);
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const setReduceMotion = useAppStore((s) => s.setReduceMotion);
  const confirmDownload = useAppStore((s) => s.confirmDownload);
  const setConfirmDownload = useAppStore((s) => s.setConfirmDownload);
  const instrument = useAppStore((s) => s.instrument);
  const setInstrument = useAppStore((s) => s.setInstrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const { plan } = usePlan();
  const [library, setLibrary] = useState<{ ok: boolean; entries: number } | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    cacheHealth()
      .then((h) => setLibrary({ ok: h.ok, entries: h.entries }))
      .catch(() => setLibrary({ ok: false, entries: 0 }));
  }, []);

  const unitLabel = stompModel === "hx-stomp-xl" ? "HX Stomp XL" : "HX Stomp";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your {unitLabel} · {instrument}. Theme, unit, and how the replica behaves. Research runs on
          the server — nothing to paste.
        </p>
      </header>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Account</h2>
        <SignedOut>
          <p className="text-sm text-muted-foreground">
            Sign in with email to use {FREE_BUILDS} free custom songs, then unlock for ${LAUNCH_USD}.
          </p>
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </SignedOut>
        <SignedIn>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <UserButton />
            {plan.paid ? (
              <span className="text-sm text-muted-foreground">
                {plan.monthUsed} / {PAID_MONTHLY_BUILDS} builds this month
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {plan.freeRemaining} free song{plan.freeRemaining === 1 ? "" : "s"} left
              </span>
            )}
          </div>
          {!plan.paid ? (
            <Button asChild variant="secondary">
              <Link to="/upgrade">Unlock StompLab — ${LAUNCH_USD}</Link>
            </Button>
          ) : null}
        </SignedIn>
      </section>

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
            checked={showFsNumbers}
            onChange={(e) => setShowFsNumbers(e.target.checked)}
          />
          <span>
            Number the footswitches 1–6
            <span className="mt-0.5 block text-xs text-muted-foreground">
              1 is top-left. Same map the .hlx writes onto the unit.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-primary"
            checked={largeControls}
            onChange={(e) => setLargeControls(e.target.checked)}
          />
          <span>
            Larger knobs and switches
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Easier on a phone. The hardware still has the same layout.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-primary"
            checked={lcdBright}
            onChange={(e) => setLcdBright(e.target.checked)}
          />
          <span>
            Brighter LCD
            <span className="mt-0.5 block text-xs text-muted-foreground">
              More glow on the replica screen. Off matches a dim stage unit.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-primary"
            checked={reduceMotion}
            onChange={(e) => setReduceMotion(e.target.checked)}
          />
          <span>
            Reduce motion
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Cuts animations on this site.
            </span>
          </span>
        </label>
        <p className="text-sm text-muted-foreground">
          Footswitches on the replica are numbered 1–6, starting top-left. That is the same map the .hlx
          writes onto the unit.
        </p>
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

      <section id="troubleshoot" className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">If something isn't working</h2>
        <details className="group border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Sign in, sign up, or forgot password
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Email and a password of 8+ characters. No Google, no X. This site does not email reset
            links. If you already paid, use the same email you used at checkout. If sign-in sits
            there doing nothing, refresh once and try again.{" "}
            <Link to="/login" className="text-primary underline underline-offset-2">
              Open sign in
            </Link>
            .
          </p>
        </details>
        <details className="group border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            "Research is busy. Try again in a minute."
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Custom songs run on the server. If it's overloaded, wait — we do not switch models.
            Featured demos still work.
          </p>
        </details>
        <details className="border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">HX Edit doesn't recognize the preset</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            File → Import, not drag-and-drop onto a setlist. Firmware 3.80 or newer. Every block in the
            file is a factory HX Stomp model — if Edit still complains, re-download from this site and
            import again. After import, press PAGE until SNAP or STOMP matches what you picked here.
          </p>
        </details>
        <details className="border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Snapshots don't change the sound</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            On this site, tap Snapshot above the replica. On the real Stomp, PAGE until the display says
            SNAP. Front switches 1–3 then recall verse / chorus / solo. Stomp mode only toggles individual
            effects.
          </p>
        </details>
        <details className="border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Download was blocked</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Some browsers block the file save. Use Copy JSON, paste it into a text file, name it
            something.hlx, then File → Import in HX Edit.
          </p>
        </details>
        <details className="border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Wrong guitar or bass models</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            The header Guitar / Bass filter is global. Switch it before you research. Catalog and featured
            songs follow it too.
          </p>
        </details>
        <details className="border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">The wah doesn't sweep</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Assign an expression pedal to Wah Position in HX Edit (EXP 1). Without a pedal you can still
            park the Position knob.
          </p>
        </details>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-foreground">DSP is in the red</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            HX Stomp has a real ceiling. Drop a cab, a second delay, or a heavy amp. The replica's
            percentage is a guide — the unit is the authority.
          </p>
        </details>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-display text-lg font-semibold text-foreground">How sharing works</h2>
        <p>
          Featured demos load instantly. Custom research uses the server. Paid users share a library
          — cache hits skip a new build and do not count toward the {PAID_MONTHLY_BUILDS}/month
          fair-use cap. Free visitors cannot browse that library. Unlock is ${LAUNCH_USD} launch / $
          {PRICE_USD} after, one time, stuck to your email.
        </p>
        {library ? (
          <p className="text-xs">
            {library.ok
              ? `Library backend on · ${library.entries} saved rigs`
              : "Library is local on this copy — featured songs still work"}
          </p>
        ) : null}
        <p>
          <Link to="/" className="text-primary underline underline-offset-2">
            Back to the Lab
          </Link>
        </p>
      </section>
    </div>
  );
}
