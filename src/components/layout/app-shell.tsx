import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Clock, Guitar, KeyRound, Library, Search, SlidersHorizontal, Sparkles, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, STOMP_DEVICES } from "@/data/categories";
import { searchModels } from "@/data/catalog";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";

const NAV = [
  { to: "/", label: "Lab", icon: Guitar },
  { to: "/catalog", label: "Catalog", icon: Library },
  { to: "/equivalents", label: "Equivalents", icon: Search },
  { to: "/create", label: "Create", icon: Sparkles },
  { to: "/gear", label: "Gear", icon: Wrench },
  { to: "/history", label: "History", icon: Clock },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrate = useAppStore((s) => s.hydrate);
  const instrument = useAppStore((s) => s.instrument);
  const setInstrument = useAppStore((s) => s.setInstrument);
  const stompModel = useAppStore((s) => s.stompModel);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const geminiKey = useAppStore((s) => s.geminiKey);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const hits = useMemo(
    () => (q.trim().length >= 2 ? searchModels(q, instrument).slice(0, 8) : []),
    [q, instrument],
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex shrink-0 items-center gap-2">
              <span className="grid size-8 place-items-center rounded-md bg-card shadow-[var(--shadow-border)]">
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
                placeholder="Search models, pedals, amps…"
                className="h-10 pl-9"
                aria-label="Search catalog"
              />
              {open && hits.length > 0 ? (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                  {hits.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-secondary"
                      onMouseDown={() => {
                        setQ("");
                        void navigate({ to: "/catalog", search: { q: m.name, cat: m.category } });
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
                </div>
              ) : null}
            </div>
            <Link
              to="/settings"
              aria-label="Gemini API key"
              className={cn(
                "relative grid size-10 shrink-0 place-items-center rounded-md border border-border bg-card",
                pathname === "/settings" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <KeyRound className="size-4" />
              {geminiKey.trim() ? (
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-emerald-400" />
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
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
                    pathname === item.to
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
        <div className="grid grid-cols-6">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px]",
                pathname === item.to ? "text-foreground" : "text-muted-foreground",
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
