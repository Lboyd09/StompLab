import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  BookOpen,
  Clock,
  Guitar,
  Library,
  Search,
  Settings,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, STOMP_DEVICES } from "@/data/categories";
import { searchModels } from "@/data/catalog";
import { DEMO_IDS, FEATURED } from "@/data/featured";
import type { StompModelId } from "@/data/types";
import { overlayUserGear } from "@/lib/preset-schema";
import { isDemoId, withStompModel } from "@/lib/preset-utils";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";
import { AuthSlot } from "./auth-slot";
import { LegalFooter } from "./legal-footer";
import { Onboarding } from "./onboarding";
import { Tutorial } from "./tutorial";
import { usePlan } from "@/lib/use-plan";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { pullMyPresets, pushMyPresets } from "@/lib/billing";

const NAV = [
  { to: "/", label: "Lab", icon: Guitar },
  { to: "/catalog", label: "Catalog", icon: Library },
  { to: "/create", label: "Create", icon: Sparkles },
  { to: "/gear", label: "Gear", icon: Wrench },
  { to: "/history", label: "History", icon: Clock },
] as const;

const DESKTOP_NAV = [
  ...NAV,
  { to: "/equivalents", label: "Equivalents", icon: ArrowRightLeft },
  { to: "/guide", label: "Guide", icon: BookOpen },
] as const;

function Mark() {
  return (
    <span className="grid size-10 place-items-center rounded-md bg-mark font-display text-lg font-bold tracking-[-0.08em] text-mark-foreground">
      SL
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrateOwner = useAppStore((s) => s.hydrateOwner);
  const replacePresets = useAppStore((s) => s.replacePresets);
  const presets = useAppStore((s) => s.presets);
  const ownerId = useAppStore((s) => s.ownerId);
  const instrument = useAppStore((s) => s.instrument);
  const setInstrument = useAppStore((s) => s.setInstrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const gear = useAppStore((s) => s.gear);
  const savePreset = useAppStore((s) => s.savePreset);
  const theme = useAppStore((s) => s.theme);
  const lcdBright = useAppStore((s) => s.lcdBright);
  const largeControls = useAppStore((s) => s.largeControls);
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const location = useRouterState({ select: (s) => s.location });
  const pathname = location.pathname;
  const catalogFind =
    pathname === "/catalog" && (location.search as { tab?: string }).tab === "find";
  const navigate = useNavigate();
  const { plan } = usePlan();
  const { user, isPending: authPending } = useCurrentUserState();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [syncReady, setSyncReady] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (authPending) return;
    setSyncReady(false);
    const local = hydrateOwner(user?.id ?? null);
    if (!user) {
      setSyncReady(true);
      return;
    }
    let cancelled = false;
    void pullMyPresets()
      .then((res) => {
        if (cancelled) return;
        if (res.presets.length) replacePresets(res.presets);
        else if (local.presets.length) {
          void pushMyPresets({ data: { presets: local.presets } }).catch(() => undefined);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setSyncReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, authPending, hydrateOwner, replacePresets]);

  useEffect(() => {
    if (!user || !syncReady || ownerId !== user.id) return;
    const timer = window.setTimeout(() => {
      void pushMyPresets({ data: { presets } }).catch(() => undefined);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [presets, user, syncReady, ownerId]);

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
    if (to === "/equivalents") return catalogFind;
    if (to === "/catalog") return pathname === "/catalog" && !catalogFind;
    return pathname === to;
  }

  function closeSearch() {
    setOpen(false);
    setQ("");
  }

  function openSong(p: (typeof FEATURED)[number]) {
    const demo = isDemoId(p.id) || (DEMO_IDS as readonly string[]).includes(p.id);
    if (!demo && !plan.paid) {
      closeSearch();
      void navigate({ to: "/upgrade" });
      return;
    }
    const preset = overlayUserGear(withStompModel({ ...p, createdAt: Date.now() }, stompModel), gear);
    savePreset(preset);
    closeSearch();
    void navigate({ to: "/preset/$id", params: { id: preset.id } });
  }

  const results = open && q.trim().length >= 2;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex shrink-0 items-center gap-2">
              <Mark />
              <span className="hidden font-display text-sm font-semibold tracking-[0.18em] uppercase sm:inline">
                Stomp Lab
              </span>
            </Link>

            <div className="relative hidden min-w-0 flex-1 md:block" data-tour="search">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => window.setTimeout(() => setOpen(false), 0)}
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
                  paid={plan.paid}
                  onSong={openSong}
                  onModel={(m) => {
                    closeSearch();
                    void navigate({ to: "/catalog", search: { q: m.name, cat: m.category, tab: "browse" } });
                  }}
                  onResearch={() => {
                    const song = q.trim();
                    closeSearch();
                    void navigate({ to: "/", search: { q: song } });
                  }}
                />
              ) : null}
            </div>

            <div className="ml-auto flex items-center gap-2">
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
                  "relative grid size-10 shrink-0 place-items-center rounded-md border border-border bg-card",
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
                  paid={plan.paid}
                  onSong={openSong}
                  onModel={(m) => {
                    closeSearch();
                    void navigate({ to: "/catalog", search: { q: m.name, cat: m.category, tab: "browse" } });
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

          <div className="flex flex-wrap items-center gap-2" data-tour="unit">
            <div className="flex rounded-full bg-secondary p-1">
              {(["guitar", "bass"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInstrument(id)}
                  className={cn(
                    "h-8 rounded-full px-3.5 text-xs font-medium capitalize",
                    instrument === id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {id}
                </button>
              ))}
            </div>
            <div className="flex rounded-full bg-secondary p-1">
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
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:pb-12">
        {children}
        <LegalFooter className="mt-16 pb-4" />
      </main>

      <Onboarding onFinished={() => setShowTutorial(true)} />
      <Tutorial force={showTutorial} onClose={() => setShowTutorial(false)} />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px]",
                pathname === item.to ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
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
    <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
      {songHits.map((p) => {
        const locked = !paid && !isDemoId(p.id);
        return (
          <button
            key={p.id}
            type="button"
            className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-secondary"
            onPointerDown={(e) => {
              e.preventDefault();
              onSong(p);
            }}
            onClick={(e) => {
              e.preventDefault();
              onSong(p);
            }}
          >
            <span>
              <span className="block text-sm">{p.song}</span>
              <span className="block text-xs text-muted-foreground">{p.artist}</span>
            </span>
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
              {locked ? "Unlock" : "Song"}
            </span>
          </button>
        );
      })}
      {modelHits.map((m) => (
        <button
          key={m.id}
          type="button"
          className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-secondary"
          onPointerDown={(e) => {
            e.preventDefault();
            onModel(m);
          }}
          onClick={(e) => {
            e.preventDefault();
            onModel(m);
          }}
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
        onPointerDown={(e) => {
          e.preventDefault();
          onResearch();
        }}
        onClick={(e) => {
          e.preventDefault();
          onResearch();
        }}
      >
        <span className="text-sm">Research “{q.trim()}”</span>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">Lab</span>
      </button>
    </div>
  );
}
