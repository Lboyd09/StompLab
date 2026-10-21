import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PaywallCard } from "@/components/layout/paywall-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { pullMyGear, pushMyGear } from "@/lib/billing";
import { newId } from "@/lib/preset-utils";
import { usePlan } from "@/lib/use-plan";
import { useAppStore } from "@/store/app-store";
import {
  brandsFor,
  GEAR_KINDS,
  modelsFor,
  popularFor,
  searchGear,
  topBrandsFor,
  type GearKind,
  type GearSuggestion,
} from "@/data/gear-catalog";
import type { UserGear } from "@/data/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gear")({ component: GearPage });

const RECENT_KEY = "stomplab.gear.recent.v1";
const RECENT_MAX = 8;

const PICKUP_LABEL: Record<NonNullable<GearSuggestion["pickups"]>, string> = {
  "single-coil": "single coils",
  p90: "P-90s",
  humbucker: "humbuckers",
  active: "active",
  mixed: "mixed pickups",
};

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    // private window or blocked storage: recents just don't stick
  }
}

function GearPage() {
  const gear = useAppStore((s) => s.gear);
  const addGear = useAppStore((s) => s.addGear);
  const removeGear = useAppStore((s) => s.removeGear);
  const setGear = useAppStore((s) => s.setGear);
  const { plan, isPending } = usePlan();
  const [kind, setKind] = useState<GearKind>("guitar");
  const [brand, setBrand] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [customName, setCustomName] = useState("");
  const [notes, setNotes] = useState("");
  const [synced, setSynced] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [shown, setShown] = useState(40);
  const [recent, setRecent] = useState<string[]>([]);
  const [allBrands, setAllBrands] = useState(false);
  const [morePopular, setMorePopular] = useState(false);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    if (!plan.canLockerSync) return;
    pullMyGear()
      .then((r) => {
        if (!r.sync) return;
        if (r.gear.length) setGear(r.gear);
        else if (gear.length) void pushMyGear({ data: { gear } });
        setSynced(true);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.canLockerSync]);

  useEffect(() => {
    setShown(40);
  }, [kind, brand, q]);

  const popular = useMemo(() => popularFor(kind), [kind]);
  const brands = useMemo(() => brandsFor(kind), [kind]);
  const topBrands = useMemo(() => topBrandsFor(kind, 12), [kind]);
  const searching = q.trim().length > 0;
  const found = useMemo(() => (searching ? searchGear(q, kind, 300) : []), [searching, q, kind]);
  const hits = useMemo(() => {
    if (searching) return brand ? found.filter((g) => g.brand === brand) : found;
    if (brand) return modelsFor(kind, brand);
    return [];
  }, [searching, found, kind, brand]);
  // Brands among the results, most hits first, so a search can be narrowed in one tap.
  const hitBrands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of found) counts.set(g.brand, (counts.get(g.brand) ?? 0) + 1);
    return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
  }, [found]);
  const recentItems = useMemo(
    () =>
      recent
        .map((name) => searchGear(name, undefined, 3).find((g) => g.name === name))
        .filter((g): g is GearSuggestion => !!g && g.kind === kind),
    [recent, kind],
  );

  const owned = useMemo(() => new Set(gear.map((g) => g.name.toLowerCase())), [gear]);

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!plan.canGear) {
    return (
      <PaywallCard
        title="Presets that know your gear"
        body="Save the guitars, pedals and amps you own. Every preset then tells you which of them to grab for that song. Part of the full Lab."
      />
    );
  }

  function persist(next: UserGear[]) {
    if (plan.canLockerSync) void pushMyGear({ data: { gear: next } }).catch(() => undefined);
  }

  function addNamed(name: string, extraNotes = "") {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (owned.has(trimmed.toLowerCase())) return;
    const item = { id: newId("gear"), kind, name: trimmed, notes: (extraNotes || notes).trim() };
    addGear(item);
    persist([item, ...gear]);
    setCustomName("");
    setNotes("");
    const nextRecent = [trimmed, ...recent.filter((r) => r.toLowerCase() !== trimmed.toLowerCase())].slice(0, RECENT_MAX);
    setRecent(nextRecent);
    writeRecent(nextRecent);
  }

  function onAddCustom(e: React.FormEvent) {
    e.preventDefault();
    addNamed(customName);
  }

  function onRemove(id: string) {
    removeGear(id);
    persist(gear.filter((g) => g.id !== id));
  }

  function selectKind(next: GearKind) {
    setKind(next);
    setBrand(null);
    setQ("");
    setCustomName("");
    setAllBrands(false);
    setMorePopular(false);
  }

  const grouped = GEAR_KINDS.map((k) => ({ kind: k, items: gear.filter((g) => g.kind === k) })).filter(
    (g) => g.items.length,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <PageHeader kicker="What you own" title="Your locker">
        Browse a brand, tap a model, done. Song research then tells you which piece to grab — guitar, amp,
        cab, or a real pedal in the loop.
        {plan.canLockerSync ? (
          <p className="mt-2 text-xs">
            {synced ? "Saved on this device and synced to your account." : "Saved on this device. Syncing to your account…"}
          </p>
        ) : (
          <p className="mt-2 text-xs">
            Saved on this device.{" "}
            <Link to="/upgrade" className="text-primary underline underline-offset-2">
              Subscribe
            </Link>{" "}
            to sync.
          </p>
        )}
      </PageHeader>

      <section className="relative space-y-4 overflow-hidden rounded-2xl border border-border bg-card p-5">
        <span className="sl-form-bar" aria-hidden />
        <div className="flex flex-wrap gap-1.5">
          {GEAR_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => selectKind(k)}
              className={cn(
                "h-11 min-w-11 rounded-full px-3 text-xs capitalize transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                kind === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${kind}s: ${SEARCH_HINT[kind]}`}
            className="h-11 pl-9 pr-11"
            aria-label="Search gear catalog"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          {q ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQ("")}
              className="absolute right-0 top-0 grid size-11 place-items-center text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {!searching && !brand ? (
          <div className="space-y-4">
            {recentItems.length ? (
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Recent</p>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {recentItems.map((g) => (
                    <CatalogRow
                      key={g.name}
                      item={g}
                      inLocker={owned.has(g.name.toLowerCase())}
                      onAdd={() => addNamed(g.name)}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
            {popular.length ? (
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Popular. Tap to add</p>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {popular.slice(0, morePopular ? popular.length : 10).map((g) => (
                    <CatalogRow
                      key={g.name}
                      item={g}
                      inLocker={owned.has(g.name.toLowerCase())}
                      onAdd={() => addNamed(g.name)}
                    />
                  ))}
                </ul>
                {popular.length > 10 ? (
                  <button
                    type="button"
                    onClick={() => setMorePopular((v) => !v)}
                    className="mt-1 inline-flex h-11 items-center px-3 text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    {morePopular ? "Fewer" : `More popular (${popular.length - 10})`}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Brands · {brands.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(allBrands ? brands : topBrands).map((b) => (
                  <BrandChip key={b} label={b} count={modelsFor(kind, b).length} onClick={() => setBrand(b)} />
                ))}
                <button
                  type="button"
                  onClick={() => setAllBrands((v) => !v)}
                  className="inline-flex h-11 items-center rounded-full border border-border px-3 text-sm text-muted-foreground md:h-9 md:text-xs"
                >
                  {allBrands ? "Fewer brands" : `All ${brands.length} brands`}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {brand ? (
                <button
                  type="button"
                  onClick={() => setBrand(null)}
                  className="inline-flex h-11 max-w-full items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground md:h-9 md:text-xs"
                >
                  <span className="truncate">{brand}</span>
                  <X className="size-3.5 shrink-0" />
                </button>
              ) : null}
              {searching && !brand
                ? hitBrands.length > 1
                  ? hitBrands.map(([b, n]) => <BrandChip key={b} label={b} count={n} onClick={() => setBrand(b)} />)
                  : null
                : null}
              {!searching && brand ? (
                <button
                  type="button"
                  className="inline-flex h-11 items-center px-2 text-xs text-muted-foreground underline-offset-4 hover:underline md:h-9"
                  onClick={() => setBrand(null)}
                >
                  All brands
                </button>
              ) : null}
            </div>
            <ul className="space-y-1">
              {hits.slice(0, shown).map((g) => (
                <CatalogRow
                  key={g.name}
                  item={g}
                  inLocker={owned.has(g.name.toLowerCase())}
                  onAdd={() => addNamed(g.name)}
                />
              ))}
            </ul>
            {hits.length === 0 ? (
              <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
                <p className="text-sm">
                  {searching ? `Nothing in the catalog for \u201c${q.trim()}\u201d.` : "No models listed for this brand."}
                </p>
                {searching ? (
                  <Button type="button" className="h-11 w-full" onClick={() => addNamed(q)}>
                    <Plus />
                    <span className="truncate">Add your own: {q.trim()}</span>
                  </Button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => {
                    setCustomName(q.trim());
                    setShowCustom(true);
                  }}
                >
                  Add it with notes
                </button>
              </div>
            ) : null}
            {hits.length > shown ? (
              <Button type="button" variant="secondary" className="w-full" onClick={() => setShown((n) => n + 40)}>
                Show more ({hits.length - shown})
              </Button>
            ) : null}
          </div>
        )}

        {showCustom ? (
          <form onSubmit={onAddCustom} className="space-y-3 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="gname">Custom name</Label>
              <Input
                id="gname"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="A model we missed"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gnotes">Notes (optional)</Label>
              <Textarea
                id="gnotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="SSS, 7.25 radius, Texas Specials. Or: 50W JCM800 into Greenbacks."
                className="min-h-20"
              />
            </div>
            <Button type="submit" disabled={!customName.trim()}>
              Add to locker
            </Button>
          </form>
        ) : (
          <button
            type="button"
            className="inline-flex h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => setShowCustom(true)}
          >
            Add your own
          </button>
        )}
      </section>

      {gear.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Empty locker. Add at least a guitar or bass so recommendations have something to aim at.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.kind} className="space-y-2">
              <h2 className="font-display text-lg font-semibold capitalize">{group.kind}s</h2>
              <ul className="space-y-2">
                {group.items.map((g) => (
                  <li
                    key={g.id}
                    className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{g.kind}</div>
                      <div className="font-medium">{g.name}</div>
                      {g.notes ? <p className="mt-1 text-sm text-muted-foreground">{g.notes}</p> : null}
                    </div>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${g.name}`} onClick={() => onRemove(g.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const SEARCH_HINT: Record<GearKind, string> = {
  guitar: "strat, lp, tele, SG",
  bass: "p bass, jazz, stingray",
  amp: "JCM800, AC30, recto",
  cab: "4x12, V30, 1960A",
  pedal: "ts9, klon, rat, big muff",
  pickup: "JB, EMG 81, P-90",
};

function BrandChip({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 max-w-full items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-medium md:h-9 md:text-xs"
    >
      <span className="truncate">{label}</span>
      <span className="tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

function CatalogRow({
  item,
  inLocker,
  onAdd,
}: {
  item: GearSuggestion;
  inLocker: boolean;
  onAdd: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={inLocker}
        onClick={onAdd}
        className={cn(
          "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
          inLocker ? "bg-secondary/50 text-muted-foreground" : "hover:bg-secondary",
        )}
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{item.model}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {item.brand}
            {item.pickups ? ` · ${PICKUP_LABEL[item.pickups]}` : ""}
          </span>
        </span>
        {inLocker ? <Check className="size-4 shrink-0" /> : <Plus className="size-4 shrink-0" />}
      </button>
    </li>
  );
}
