import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Plus, Search, Trash2 } from "lucide-react";
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
import { brandsFor, GEAR_KINDS, modelsFor, popularFor, searchGear, type GearKind, type GearSuggestion } from "@/data/gear-catalog";
import type { UserGear } from "@/data/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gear")({ component: GearPage });

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

  const popular = useMemo(() => popularFor(kind), [kind]);
  const brands = useMemo(() => brandsFor(kind), [kind]);
  const hits = useMemo(() => {
    if (q.trim()) return searchGear(q, kind);
    if (brand) return modelsFor(kind, brand);
    return [];
  }, [kind, brand, q]);

  const owned = useMemo(() => new Set(gear.map((g) => g.name.toLowerCase())), [gear]);

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!plan.canGear) {
    return (
      <PaywallCard
        title="Gear locker is in the full Lab"
        body="Save the guitars, basses, and amps you actually own. Research then tells you which piece to grab — and when to skip the Stomp amp and run four-cable method into a real head."
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
          <p className="mt-2 text-xs">{synced ? "Synced to your account." : "Syncing locker…"}</p>
        ) : (
          <p className="mt-2 text-xs">
            Saved on this device.{" "}
            <Link to="/upgrade" className="text-primary underline underline-offset-2">
              Subscribe
            </Link>{" "}
            to sync the locker across devices.
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
            onChange={(e) => {
              setQ(e.target.value);
              setBrand(null);
            }}
            placeholder={`Search ${kind}s — Strat, Dual Rectifier, Big Muff…`}
            className="h-11 pl-9"
            aria-label="Search gear catalog"
          />
        </div>

        {!q.trim() && !brand ? (
          <div className="space-y-4">
            {popular.length ? (
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Common — tap to add</p>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {popular.map((g) => (
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
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Browse a brand · {brands.length}
              </p>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-border bg-secondary/30 p-2">
                <div className="flex flex-wrap gap-1.5">
                  {brands.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBrand(b)}
                      className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium"
                    >
                      <span className="truncate">{b}</span>
                      <span className="tabular-nums text-muted-foreground">{modelsFor(kind, b).length}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {brand && !q.trim() ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{brand}</p>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setBrand(null)}
                >
                  All brands
                </button>
              </div>
            ) : null}
            <ul className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
              {hits.map((g) => (
                <CatalogRow
                  key={g.name}
                  item={g}
                  inLocker={owned.has(g.name.toLowerCase())}
                  onAdd={() => addNamed(g.name)}
                />
              ))}
              {hits.length === 0 ? (
                <li className="py-6 text-sm text-muted-foreground">No catalog match. Add a custom name below.</li>
              ) : null}
            </ul>
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
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => setShowCustom(true)}
          >
            My model isn’t listed
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
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{g.kind}</div>
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
          <span className="block text-[11px] text-muted-foreground">{item.brand}</span>
        </span>
        {inLocker ? <Check className="size-4 shrink-0" /> : <Plus className="size-4 shrink-0" />}
      </button>
    </li>
  );
}
