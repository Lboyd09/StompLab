import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { replayTutorial } from "@/components/layout/tutorial";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { DEVICE_MAP, STOMP_DEVICES } from "@/data/categories";
import { FREE_BUILDS, PRICE_MONTHLY_USD, PRICE_YEARLY_USD, formatUsd } from "@/lib/plan";
import type { FsModePref, ThemeId } from "@/lib/storage";
import { usePlan } from "@/lib/use-plan";
import { useAppStore } from "@/store/app-store";
import { WahSelect } from "@/components/layout/wah-select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 rounded-full px-4 text-sm font-medium transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-secondary/50 px-4 py-3.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{hint}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 size-5 shrink-0 accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

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
  const wahMode = useAppStore((s) => s.wahMode);
  const setWahMode = useAppStore((s) => s.setWahMode);
  const wahModelId = useAppStore((s) => s.wahModelId);
  const setWahModelId = useAppStore((s) => s.setWahModelId);
  const { plan, isPending: planPending } = usePlan();
  const { user, isPending: authPending } = useCurrentUserState();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const unitLabel = DEVICE_MAP[stompModel]?.name ?? "HX Stomp";
  const accountPending = !mounted || authPending || planPending;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader kicker="The replica" title="Settings">
        Your {unitLabel} · {instrument}. Theme, unit, and how the replica feels.
      </PageHeader>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Account</h2>
        {accountPending ? (
          <p className="text-sm text-muted-foreground">Checking your account…</p>
        ) : user ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{user.displayName || "Signed in"}</p>
                <p className="text-xs text-muted-foreground">{user.primaryEmail}</p>
              </div>
              {plan.paid ? (
                <span className="text-sm text-muted-foreground">
                  {plan.admin ? "Full Lab" : `${plan.monthUsed} / ${plan.monthLimit} this month`}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {plan.freeRemaining} free song{plan.freeRemaining === 1 ? "" : "s"} left
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link to="/account">Account</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/account">Invite a friend</Link>
              </Button>
              {!plan.paid ? (
                <Button asChild>
                  <Link to="/upgrade">Subscribe — {formatUsd(PRICE_MONTHLY_USD)}/mo</Link>
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Sign in for {FREE_BUILDS} free custom songs, then subscribe for any title. Signed-in
              accounts get an invite link — a friend creates a new account, you both get 3 extra custom
              builds.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/upgrade">See plans</Link>
              </Button>
            </div>
          </>
        )}
      </section>

      <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Look and feel</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => replayTutorial()}>
            Replay tutorial
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Theme</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["dark", "Dark"],
                ["light", "Light"],
                ["system", "Match device"],
              ] as const
            ).map(([id, label]) => (
              <Chip key={id} active={theme === id} onClick={() => setTheme(id satisfies ThemeId)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Instrument</p>
          <div className="flex flex-wrap gap-2">
            {(["guitar", "bass"] as const).map((id) => (
              <Chip key={id} active={instrument === id} onClick={() => setInstrument(id)}>
                {id === "guitar" ? "Guitar" : "Bass"}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Unit</p>
          <p className="text-xs text-muted-foreground">The replica and the download file follow this.</p>
          <div className="grid grid-cols-2 gap-2">
            {STOMP_DEVICES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setStompModel(d.id)}
                className={cn(
                  "h-12 rounded-xl px-3 text-left text-sm font-medium",
                  stompModel === d.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-muted",
                )}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">When a rig opens</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["auto", "Match the song"],
                ["snapshot", "Snapshot mode"],
                ["stomp", "Stomp mode"],
              ] as const
            ).map(([id, label]) => (
              <Chip key={id} active={defaultFsMode === id} onClick={() => setDefaultFsMode(id satisfies FsModePref)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Replica</h2>
        <div className="space-y-2">
          <ToggleRow
            checked={showDsp}
            onChange={setShowDsp}
            title="Show DSP load"
            hint="The percentage in the corner of the display."
          />
          <ToggleRow
            checked={showFsNumbers}
            onChange={setShowFsNumbers}
            title="Number the footswitches"
            hint="1 is top-left — same numbers the file writes onto the unit."
          />
          <ToggleRow
            checked={largeControls}
            onChange={setLargeControls}
            title="Larger knobs and switches"
            hint="Easier on a phone. The hardware layout stays the same."
          />
          <ToggleRow
            checked={lcdBright}
            onChange={setLcdBright}
            title="Brighter LCD"
            hint="More glow on the replica screen."
          />
          <ToggleRow
            checked={reduceMotion}
            onChange={setReduceMotion}
            title="Reduce motion"
            hint="Cuts animations on this site."
          />
          <ToggleRow
            checked={confirmDownload}
            onChange={setConfirmDownload}
            title="Confirm before download"
            hint="Extra tap so a misclick doesn’t save a file."
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Wah</h2>
        <p className="text-sm text-muted-foreground">
          Default after you build. If you already own a wah, leave it on Pedal — it stays in front of the
          unit.
        </p>
        <WahSelect mode={wahMode} modelId={wahModelId} onMode={setWahMode} onModel={setWahModelId} />
      </section>

      <section id="troubleshoot" className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">If something isn’t working</h2>
        <details className="group border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium">Sign in or forgot password</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Email and a password of 12+ characters on new accounts. Forgot it? Request a reset from{" "}
            <Link to="/login" className="text-primary underline underline-offset-2">
              Sign in
            </Link>{" "}
            or Account. The link expires in 15 minutes.
          </p>
        </details>
        <details className="group border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium">Research is busy</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Wait a minute and try again. The three demos still work.
          </p>
        </details>
        <details className="border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium">HX Edit doesn’t recognize the preset</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            File → Import — don’t drag onto a setlist. Firmware 3.80 or newer. After import, press PAGE
            until the screen says SNAP or STOMP.
          </p>
        </details>
        <details className="border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium">Snapshots don’t change the sound</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Tap Snapshot above the replica. On the unit, PAGE until it says SNAP. Switches 1–3 then
            recall verse / chorus / solo.
          </p>
        </details>
        <details className="border-b border-border pb-3">
          <summary className="cursor-pointer text-sm font-medium">The wah doesn’t sweep</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Default: your real wah lives in front of the unit. To use the modeler’s wah, pick Helix wah
            above, then re-open the preset.
          </p>
        </details>
        <details>
          <summary className="cursor-pointer text-sm font-medium">DSP is in the red</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Drop a cab, a second delay, or a heavy amp. The percentage is a guide — the unit is the
            authority.
          </p>
        </details>
      </section>

      {!plan.paid && !plan.admin && !accountPending ? (
        <section className="space-y-3 rounded-2xl bg-primary p-5 text-primary-foreground">
          <h2 className="sl-hero-title text-2xl">Unlock every song</h2>
          <p className="text-sm text-primary-foreground/80">
            {FREE_BUILDS} custom builds after sign-in, then {formatUsd(PRICE_MONTHLY_USD)}/mo or{" "}
            {formatUsd(PRICE_YEARLY_USD)}/yr. Demos stay free.
          </p>
          <Button asChild variant="secondary">
            <Link to="/upgrade">Subscribe</Link>
          </Button>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link to="/" className="text-primary underline underline-offset-2">
            Back to the Lab
          </Link>
        </p>
      )}
    </div>
  );
}
