import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Clock,
  Guitar,
  Library,
  ListMusic,
  Lock,
  Search,
  Settings,
  Sparkles,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, STOMP_DEVICES } from "@/data/categories";
import { searchModels } from "@/data/catalog";
import { DEMO_IDS, FEATURED } from "@/data/featured";
import type { StompModelId } from "@/data/types";
import { isDemoId } from "@/lib/preset-utils";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";
import { AuthSlot } from "./auth-slot";
import { LegalFooter } from "./legal-footer";
import { BrandLockup } from "./mark";
import { Onboarding } from "./onboarding";
import { PageWash } from "./page-wash";
import { Tutorial } from "./tutorial";
import { UnitChip } from "./unit-chip";
import { usePlan } from "@/lib/use-plan";
import { useOpenFeatured } from "@/lib/use-open-featured";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { pullMyPresets, pullMySetlists, pushMyPresets, pushMySetlists } from "@/lib/billing";
import { jsonFingerprint, shouldPushSync } from "@/lib/edge-budget";
import { accountIsBehind, mergeHistory } from "@/lib/storage";
import { captureReferralCode } from "@/lib/referral-code";

const NAV = [
  { to: "/", label: "Lab", icon: Guitar },
  { to: "/catalog", label: "Catalog", icon: Library },
  { to: "/setlist", label: "Setlists", icon: ListMusic },
  { to: "/gear", label: "Gear", icon: Wrench },
  { to: "/history", label: "History", icon: Clock },
] as const;

const DESKTOP_NAV = [
  ...NAV,
  { to: "/create", label: "Create", icon: Sparkles },
  { to: "/guide", label: "Guide", icon: BookOpen },
] as const;

const PULL_RETRY_MS = [0, 2000, 6000, 15000];

/** A pull that returns null on failure, tried a few times with growing waits. Null if all fail. */
async function pullWithRetry<T>(pull: () => Promise<T | null>, cancelled: () => boolean): Promise<T | null> {
  for (const wait of PULL_RETRY_MS) {
    if (wait) await new Promise((r) => window.setTimeout(r, wait));
    if (cancelled()) return null;
    try {
      const res = await pull();
      if (res) return res;
    } catch {
      /* try again */
    }
  }
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrateOwner = useAppStore((s) => s.hydrateOwner);
  const replacePresets = useAppStore((s) => s.replacePresets);
  const setHistoryReady = useAppStore((s) => s.setHistoryReady);
  const syncTick = useAppStore((s) => s.syncTick);
  const presets = useAppStore((s) => s.presets);
  const setlists = useAppStore((s) => s.setlists);
  const replaceSetlists = useAppStore((s) => s.replaceSetlists);
  const ownerId = useAppStore((s) => s.ownerId);
  const instrument = useAppStore((s) => s.instrument);
  const setInstrument = useAppStore((s) => s.setInstrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const openFeaturedPreset = useOpenFeatured();
  const theme = useAppStore((s) => s.theme);
  const lcdBright = useAppStore((s) => s.lcdBright);
  const largeControls = useAppStore((s) => s.largeControls);
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const location = useRouterState({ select: (s) => s.location });
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { plan, isPending: planPending } = usePlan();
  const { user, isPending: authPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [syncReady, setSyncReady] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastSynced = useRef("");
  const handledTick = useRef(0);
  const [setlistSyncReady, setSetlistSyncReady] = useState(false);
  const lastSetlistSync = useRef("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      setQ("");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      captureReferralCode(params.get("ref"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (authPending) return;
    setSyncReady(false);
    setHistoryReady(false);
    hydrateOwner(userId);
    if (!userId) {
      lastSynced.current = "";
      setSyncReady(true);
      setHistoryReady(true);
      return;
    }
    let cancelled = false;
    void pullWithRetry(() => pullMyPresets().then((r) => (r.ok ? r : null)), () => cancelled).then((res) => {
      if (cancelled) return;
      // Never push without a good pull: the account row is the whole list, a blind push would erase it.
      if (!res) {
        setHistoryReady(true);
        return;
      }
      // Merge, don't replace: a build saved here in the last few seconds may not be on the account yet.
      const merged = mergeHistory(useAppStore.getState().presets, res.presets);
      replacePresets(merged);
      lastSynced.current = jsonFingerprint(merged);
      if (accountIsBehind(merged, res.presets)) {
        void pushMyPresets({ data: { presets: merged } }).catch(() => undefined);
      }
      handledTick.current = useAppStore.getState().syncTick;
      setHistoryReady(true);
      setSyncReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, authPending, hydrateOwner, replacePresets, setHistoryReady]);

  useEffect(() => {
    if (!userId || !syncReady || ownerId !== userId) return;
    // A build, an open or a delete goes up right away; knob turns wait for a quiet moment.
    const urgent = syncTick !== handledTick.current;
    const timer = window.setTimeout(
      () => {
        handledTick.current = syncTick;
        const next = useAppStore.getState().presets;
        if (!shouldPushSync(lastSynced.current, next)) return;
        lastSynced.current = jsonFingerprint(next);
        void pushMyPresets({ data: { presets: next } }).catch(() => undefined);
      },
      urgent ? 300 : 8000,
    );
    return () => window.clearTimeout(timer);
  }, [presets, syncTick, userId, syncReady, ownerId]);

  // Setlists follow the same account sync as History, on their own so one failing never blocks the other.
  const canSyncSetlists = plan.signedIn && (plan.paid || plan.admin);
  useEffect(() => {
    if (authPending) return;
    setSetlistSyncReady(false);
    if (!userId) {
      lastSetlistSync.current = "";
      return;
    }
    hydrateOwner(userId);
    let cancelled = false;
    void pullWithRetry(
      () => pullMySetlists().then((res) => (res.ok ? res : null)),
      () => cancelled,
    ).then((res) => {
      if (cancelled) return;
      if (!res) {
        // Still unreachable after retries: only push once this device changes a setlist, so a stale
        // copy here never overwrites the account just because it loaded.
        lastSetlistSync.current = jsonFingerprint(useAppStore.getState().setlists);
      } else if (res.setlists.length) {
        replaceSetlists(res.setlists);
        lastSetlistSync.current = jsonFingerprint(useAppStore.getState().setlists);
      } else {
        lastSetlistSync.current = jsonFingerprint([]);
      }
      setSetlistSyncReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, authPending, hydrateOwner, replaceSetlists]);

  useEffect(() => {
    if (!userId || !setlistSyncReady || !canSyncSetlists || ownerId !== userId) return;
    if (!shouldPushSync(lastSetlistSync.current, setlists)) return;
    const nextFp = jsonFingerprint(setlists);
    const timer = window.setTimeout(() => {
      void pushMySetlists({ data: { setlists } })
        .then((res) => {
          if (res.ok) lastSetlistSync.current = nextFp;
        })
        .catch(() => undefined);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [setlists, userId, setlistSyncReady, canSyncSetlists, ownerId]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) => {
      root.classList.toggle("dark", dark);
      root.classList.toggle("light", !dark);
    };
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches);
      const onChange = () => apply(mq.matches);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    apply(theme !== "light");
    return undefined;
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.lcd = lcdBright ? "bright" : "normal";
    root.dataset.controls = largeControls ? "large" : "normal";
    root.dataset.motion = reduceMotion ? "reduce" : "ok";
  }, [lcdBright, largeControls, reduceMotion]);

  const modelHits = useMemo(
    () => (q.trim().length >= 2 ? searchModels(q, instrument).slice(0, 6) : []),
    [q, instrument],
  );
  const songHits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return FEATURED.filter((p) => {
      const hay = `${p.song ?? ""} ${p.artist ?? ""} ${p.name}`.toLowerCase();
      return hay.includes(needle);
    }).slice(0, 4);
  }, [q]);

  function isActive(to: string) {
    return pathname === to || (to === "/catalog" && pathname.startsWith("/catalog"));
  }

  function closeSearch() {
    setOpen(false);
    setQ("");
  }

  function openSong(p: (typeof FEATURED)[number]) {
    const demo = isDemoId(p.id) || (DEMO_IDS as readonly string[]).includes(p.id);
    if (!demo && !plan.paid && !plan.admin) {
      closeSearch();
      if (planPending) {
        toast.message("Still loading your account. Try again in a second.");
        return;
      }
      void navigate({ to: "/upgrade" });
      return;
    }
    const preset = openFeaturedPreset(p.id);
    closeSearch();
    if (preset) void navigate({ to: "/preset/$id", params: { id: preset.id } });
  }

  const results = open && q.trim().length >= 2;

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background text-foreground">
      <PageWash />
      <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/" className="flex min-w-0 shrink-0 items-center" aria-label="Stomp Lab">
              <BrandLockup className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
            </Link>
            <div className="min-w-0 flex-1 md:hidden" data-tour="unit">
              <UnitChip />
            </div>

            <div className="relative hidden min-w-0 flex-1 md:block" data-tour="search">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => window.setTimeout(() => setOpen(false), 220)}
                placeholder="Search songs, models, pedals…"
                className="h-10 pl-9"
                aria-label="Search songs and catalog"
                autoComplete="off"
                suppressHydrationWarning
              />
              {results ? (
                <SearchResults
                  songHits={songHits}
                  modelHits={modelHits}
                  q={q}
                  paid={plan.paid || plan.admin || planPending}
                  onSong={openSong}
                  onModel={(m) => {
                    closeSearch();
                    void navigate({ to: "/catalog/$id", params: { id: m.id } });
                  }}
                  onResearch={() => {
                    const song = q.trim();
                    closeSearch();
                    void navigate({ to: "/", search: { q: song } });
                  }}
                />
              ) : null}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Link
                to="/account"
                className="hidden h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:text-pop sm:inline-flex"
              >
                <UserPlus className="size-3.5" />
                Invite
              </Link>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground md:hidden"
                aria-label={open ? "Close search" : "Search"}
                data-tour="search"
                onClick={() => {
                  setOpen((v) => !v);
                  window.setTimeout(() => searchRef.current?.focus(), 30);
                }}
              >
                {open ? <X className="size-4" /> : <Search className="size-4" />}
              </button>
              <AuthSlot />
              <Link
                to="/settings"
                aria-label="Settings"
                className={cn(
                  "relative grid size-10 shrink-0 place-items-center rounded-md border border-border bg-card transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                  pathname === "/settings" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Settings className="size-4" />
              </Link>
            </div>
          </div>

          {open ? (
            <div className="relative md:hidden">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Song, model, pedal…"
                className="h-11 pl-9"
                aria-label="Search songs and catalog"
                autoComplete="off"
              />
              {results ? (
                <SearchResults
                  songHits={songHits}
                  modelHits={modelHits}
                  q={q}
                  paid={plan.paid || plan.admin || planPending}
                  onSong={openSong}
                  onModel={(m) => {
                    closeSearch();
                    void navigate({ to: "/catalog/$id", params: { id: m.id } });
                  }}
                  onResearch={() => {
                    const song = q.trim();
                    closeSearch();
                    void navigate({ to: "/", search: { q: song } });
                  }}
                />
              ) : null}
            </div>
          ) : null}

          <div className="hidden flex-wrap items-center gap-2 md:flex" data-tour="unit">
            <div className="hidden rounded-full bg-secondary p-1 md:flex">
              {(["guitar", "bass"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInstrument(id)}
                  className={cn(
                    "h-8 rounded-full px-3.5 text-xs font-medium capitalize transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                    instrument === id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {id}
                </button>
              ))}
            </div>
            <div className="hidden rounded-full bg-secondary p-1 md:flex">
              <label className="sr-only" htmlFor="device">
                Unit
              </label>
              <select
                id="device"
                value={stompModel}
                onChange={(e) => setStompModel(e.target.value as StompModelId)}
                className="h-8 rounded-full bg-transparent px-3 text-base font-medium md:text-xs"
              >
                {STOMP_DEVICES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.short}
                  </option>
                ))}
              </select>
            </div>
            <nav className="ml-auto hidden items-center gap-1 md:flex">
              {DESKTOP_NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
                    isActive(item.to)
                      ? "bg-card text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                    "transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <span className="sl-header-rule" aria-hidden />
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-10 md:pb-20 md:pt-16">
        {children}
        <LegalFooter className="mt-16 pb-4" />
      </main>

      <Onboarding onFinished={() => setShowTutorial(true)} />
      <Tutorial force={showTutorial} onClose={() => setShowTutorial(false)} />

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {NAV.map((item) => {
            const locked = item.to === "/setlist" && !plan.paid && !plan.admin && !planPending;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive(item.to) ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 text-xs transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                  isActive(item.to) ? "text-primary" : "text-muted-foreground",
                )}
              >
                {isActive(item.to) ? (
                  <span className="absolute top-0 h-0.5 w-5 rounded-full bg-pop" aria-hidden />
                ) : null}
                <span className="relative">
                  <item.icon className="size-5" />
                  {locked ? (
                    <Lock
                      className="absolute -right-2 -top-1.5 size-3 rounded-full bg-background text-muted-foreground"
                      aria-hidden
                    />
                  ) : null}
                </span>
                {item.label}
                {locked ? <span className="sr-only"> (subscribers)</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SearchResults({
  songHits,
  modelHits,
  q,
  paid,
  onSong,
  onModel,
  onResearch,
}: {
  songHits: typeof FEATURED;
  modelHits: ReturnType<typeof searchModels>;
  q: string;
  paid: boolean;
  onSong: (p: (typeof FEATURED)[number]) => void;
  onModel: (m: ReturnType<typeof searchModels>[number]) => void;
  onResearch: () => void;
}) {
  return (
    <div
      className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
    >
      {songHits.map((p) => {
        const locked = !paid && !isDemoId(p.id);
        return (
          <button
            key={p.id}
            type="button"
            className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-secondary"
            onClick={() => onSong(p)}
          >
            <span>
              <span className="block text-sm">{p.song}</span>
              <span className="block text-xs text-muted-foreground">{p.artist}</span>
            </span>
            <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">
              {locked ? "Paid" : "Song"}
            </span>
          </button>
        );
      })}
      {modelHits.map((m) => (
        <button
          key={m.id}
          type="button"
          className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-secondary"
          onClick={() => onModel(m)}
        >
          <span>
            <span className="block text-sm">{m.name}</span>
            <span className="block text-xs text-muted-foreground">{m.basedOn}</span>
          </span>
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
            {CATEGORIES.find((c) => c.id === m.category)?.short}
          </span>
        </button>
      ))}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 border-t border-border px-3 py-2.5 text-left hover:bg-secondary"
        onClick={() => onResearch()}
      >
        <span className="text-sm">Research “{q.trim()}”</span>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">Lab</span>
      </button>
    </div>
  );
}
