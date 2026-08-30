import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  BookOpen,
  Clock,
  Guitar,
  KeyRound,
  Library,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, STOMP_DEVICES } from "@/data/categories";
import { searchModels } from "@/data/catalog";
import { FEATURED } from "@/data/featured";
import { overlayUserGear } from "@/lib/preset-schema";
import { withStompModel } from "@/lib/preset-utils";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrate = useAppStore((s) => s.hydrate);
  const instrument = useAppStore((s) => s.instrument);
  const setInstrument = useAppStore((s) => s.setInstrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const geminiKey = useAppStore((s) => s.geminiKey);
  const gear = useAppStore((s) => s.gear);
  const savePreset = useAppStore((s) => s.savePreset);
  const theme = useAppStore((s) => s.theme);
  const location = useRouterState({ select: (s) => s.location });
  const pathname = location.pathname;
  const catalogFind =
    pathname === "/catalog" && (location.search as { tab?: string }).tab === "find";
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex shrink-0 items-center gap-2">
              <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
                <SlidersHorizontal className="size-4" />
              </span>
              <span className="font-display text-sm font-semibold tracking-[0.18em] uppercase">
                Stomp Lab
              </span>
            </Link>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => window.setTimeout(() => setOpen(false), 160)}
                placeholder="Search songs, models, pedals…"
                className="h-10 pl-9"
                aria-label="Search songs and catalog"
              />
              {open && q.trim().length >= 2 ? (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                  {songHits.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-secondary"
                      onMouseDown={() => {
                        const preset = overlayUserGear(
                          withStompModel({ ...p, createdAt: Date.now() }, stompModel),
                          gear,
                        );
                        savePreset(preset);
                        setQ("");
                        void navigate({ to: "/preset/$id", params: { id: preset.id } });
                      }}
                    >
                      <span>
                        <span className="block text-sm">{p.song}</span>
                        <span className="block text-xs text-muted-foreground">{p.artist}</span>
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                        Song
                      </span>
                    </button>
                  ))}
                  {modelHits.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-secondary"
                      onMouseDown={() => {
                        setQ("");
                        void navigate({ to: "/catalog", search: { q: m.name, cat: m.category, tab: "browse" } });
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
                    onMouseDown={() => {
                      const song = q.trim();
                      setQ("");
                      void navigate({ to: "/", search: { q: song } });
                    }}
                  >
                    <span className="text-sm">Research “{q.trim()}”</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Lab
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
            <Link
              to="/settings"
              aria-label="Settings"
              className={cn(
                "relative grid size-10 shrink-0 place-items-center rounded-md border border-border bg-card",
                pathname === "/settings" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <KeyRound className="size-4" />
              {geminiKey.trim() ? (
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
              ) : null}
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              {STOMP_DEVICES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setStompModel(d.id)}
                  className={cn(
                    "h-8 rounded-full px-3.5 text-xs font-medium",
                    stompModel === d.id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {d.short}
                </button>
              ))}
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

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:pb-12">{children}</main>

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
