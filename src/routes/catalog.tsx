import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GearShopLinks } from "@/components/layout/gear-shop-links";
import { GeminiHint } from "@/components/layout/gemini-hint";
import { UpgradeBanner } from "@/components/layout/upgrade-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, CATEGORY_MAP } from "@/data/categories";
import { MODEL_MAP, findEquivalents, searchModels } from "@/data/catalog";
import type { CategoryId } from "@/data/types";
import { notifyResearchError, notifyResearchSource } from "@/lib/notify";
import { lookupEquivalentFn } from "@/lib/research";
import { usePlan } from "@/lib/use-plan";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

type Search = { q: string; cat: string; tab: string };

export const Route = createFileRoute("/catalog")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : "",
    cat: typeof s.cat === "string" ? s.cat : "",
    tab: s.tab === "find" ? "find" : "browse",
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const setSearch = Route.useNavigate();
  const instrument = useAppStore((s) => s.instrument);
  const { plan, isPending: planPending } = usePlan();
  const [localQ, setLocalQ] = useState(search.q);
  const [eqQuery, setEqQuery] = useState(search.tab === "find" ? search.q : "");
  const [busy, setBusy] = useState(false);
  const [aiHits, setAiHits] = useState<{ modelId: string; closeness: string; how: string }[] | null>(
    null,
  );
  const cat = (search.cat as CategoryId | "") || "";
  const tab = search.tab === "find" ? "find" : "browse";

  const models = useMemo(() => {
    const base = searchModels(search.q, instrument);
    return cat ? base.filter((m) => m.category === cat) : base;
  }, [search.q, cat, instrument]);

  const local = useMemo(() => findEquivalents(eqQuery, 8), [eqQuery]);

  async function onAsk(e: React.FormEvent) {
    e.preventDefault();
    if (eqQuery.trim().length < 2) return;
    if (planPending) return;
    if (!plan.signedIn) {
      await navigate({ to: "/login", search: { next: "/catalog" } });
      return;
    }
    if (!plan.paid) {
      await navigate({ to: "/upgrade" });
      return;
    }
    setBusy(true);
    try {
      const result = await lookupEquivalentFn({ data: { query: eqQuery.trim() } });
      if (!result.ok) {
        notifyResearchError(result, {
          login: () => void navigate({ to: "/login" }),
          upgrade: () => void navigate({ to: "/upgrade" }),
        });
        return;
      }
      setAiHits(result.matches);
      notifyResearchSource(result.source);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lookup failed";
      if (message === "Unauthorized") {
        await navigate({ to: "/login", search: { next: "/catalog" } });
        return;
      }
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <UpgradeBanner plan={plan} pending={planPending} />
      <header className="space-y-2">
        <h1 className="font-display text-4xl font-semibold uppercase leading-[0.9] tracking-tight">HX catalog</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every amp, cab, mic, and effect on the HX Stomp — plus a finder that maps a real pedal to
          the Line 6 name.
        </p>
      </header>

      <div className="flex rounded-full bg-secondary p-1 w-fit">
        <button
          type="button"
          onClick={() => setSearch({ search: (p) => ({ ...p, tab: "browse" }) })}
          className={cn(
            "h-8 rounded-full px-4 text-xs font-medium",
            tab === "browse" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          Browse models
        </button>
        <button
          type="button"
          onClick={() => setSearch({ search: (p) => ({ ...p, tab: "find" }) })}
          className={cn(
            "h-8 rounded-full px-4 text-xs font-medium",
            tab === "find" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          Find equivalent
        </button>
      </div>

      {tab === "find" ? (
        <div className="mx-auto max-w-2xl space-y-6">
          <form onSubmit={onAsk} className="space-y-3">
            <Label htmlFor="eq">Pedal or amp</Label>
            <div className="flex gap-2">
              <Input
                id="eq"
                value={eqQuery}
                onChange={(e) => {
                  setEqQuery(e.target.value);
                  setAiHits(null);
                }}
                placeholder="Ibanez TS808, Klon Centaur, Ampeg SVT…"
              />
              <Button type="submit" disabled={busy || planPending || eqQuery.trim().length < 2}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Explain"}
              </Button>
            </div>
            <GeminiHint plan={plan} pending={planPending} />
          </form>

          {aiHits?.length ? (
            <section className="space-y-3">
              <h2 className="text-xs uppercase tracking-[0.16em] text-muted-foreground">From research</h2>
              {aiHits.map((h) => {
                const m = MODEL_MAP[h.modelId];
                if (!m) return null;
                return (
                  <article key={h.modelId} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-semibold">{m.name}</h3>
                      <Badge>{h.closeness}</Badge>
                      <span className="text-xs text-muted-foreground">{CATEGORY_MAP[m.category].label}</span>
                    </div>
                    <p className="mt-1 text-xs text-foreground/80">Based on {m.basedOn}</p>
                    <GearShopLinks name={m.name} basedOn={m.basedOn} compact />
                    <p className="mt-2 text-sm text-muted-foreground">{h.how}</p>
                  </article>
                );
              })}
            </section>
          ) : null}

          {local.length ? (
            <section className="space-y-3">
              <h2 className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Instant matches</h2>
              {local.map((h) => {
                const m = MODEL_MAP[h.modelId];
                if (!m) return null;
                return (
                  <article key={h.modelId} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display font-semibold">{m.name}</h3>
                      <span className="font-mono text-[10px] text-muted-foreground">{h.score}</span>
                    </div>
                    <p className="mt-1 text-xs">Based on {m.basedOn}</p>
                    <GearShopLinks name={m.name} basedOn={m.basedOn} compact />
                    <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{h.reason}</p>
                  </article>
                );
              })}
            </section>
          ) : eqQuery.trim().length >= 2 && !busy ? (
            <p className="text-sm text-muted-foreground">
              No instant match. Hit Explain to research an equivalent.
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <Input
            value={localQ}
            onChange={(e) => {
              setLocalQ(e.target.value);
              void setSearch({ search: (prev) => ({ ...prev, q: e.target.value }) });
            }}
            placeholder="Filter by name, Boss, Marshall, Big Muff…"
            aria-label="Filter catalog"
          />

          <div className="flex gap-2 overflow-x-auto pb-1">
            <CatChip
              active={!cat}
              label="All"
              onClick={() => setSearch({ search: (p) => ({ ...p, cat: "" }) })}
            />
            {CATEGORIES.map((c) => (
              <CatChip
                key={c.id}
                active={cat === c.id}
                label={c.label}
                color={c.lcd}
                onClick={() =>
                  setSearch({ search: (p) => ({ ...p, cat: p.cat === c.id ? "" : c.id }) })
                }
              />
            ))}
          </div>

          {cat && CATEGORY_MAP[cat as CategoryId] ? (
            <p className="text-sm text-muted-foreground">{CATEGORY_MAP[cat as CategoryId].description}</p>
          ) : null}

          <p className="text-xs text-muted-foreground tabular-nums">
            {models.length} {instrument} models
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((m) => {
              const c = CATEGORY_MAP[m.category];
              return (
                <article
                  key={m.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-border)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: c.lcd }} />
                    <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {c.label}
                    </span>
                    {m.io === "legacy" ? <Badge variant="outline">Legacy</Badge> : null}
                    {m.dsp === "heavy" ? <Badge variant="outline">Heavy DSP</Badge> : null}
                  </div>
                  <h2 className="mt-2 font-display text-base font-semibold">{m.name}</h2>
                  <p className="mt-1 text-xs text-foreground/80">Based on {m.basedOn}</p>
                  <GearShopLinks name={m.name} basedOn={m.basedOn} compact />
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.description}</p>
                  <p className="mt-3 font-mono text-[10px] text-muted-foreground">
                    {m.params.slice(0, 6).join(" · ")}
                  </p>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CatChip({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
      )}
    >
      {color ? <span className="size-1.5 rounded-full" style={{ background: color }} /> : null}
      {label}
    </button>
  );
}
