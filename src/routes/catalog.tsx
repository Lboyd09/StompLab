import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_MAP } from "@/data/categories";
import { ALL_MODELS, searchModels } from "@/data/catalog";
import type { CategoryId } from "@/data/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

type Search = { q: string; cat: string };

export const Route = createFileRoute("/catalog")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : "",
    cat: typeof s.cat === "string" ? s.cat : "",
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const instrument = useAppStore((s) => s.instrument);
  const [localQ, setLocalQ] = useState(search.q);
  const cat = (search.cat as CategoryId | "") || "";

  const models = useMemo(() => {
    const base = searchModels(search.q, instrument);
    return cat ? base.filter((m) => m.category === cat) : base;
  }, [search.q, cat, instrument]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">HX catalog</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every amp, cab, mic, and effect on the HX Stomp — with the real unit it was modeled on, and
          what it actually does. {ALL_MODELS.length} models.
        </p>
      </header>

      <Input
        value={localQ}
        onChange={(e) => {
          setLocalQ(e.target.value);
          void navigate({ search: (prev) => ({ ...prev, q: e.target.value }) });
        }}
        placeholder="Filter by name, Boss, Marshall, Big Muff…"
        aria-label="Filter catalog"
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        <CatChip
          active={!cat}
          label="All"
          onClick={() => navigate({ search: (p) => ({ ...p, cat: "" }) })}
        />
        {CATEGORIES.map((c) => (
          <CatChip
            key={c.id}
            active={cat === c.id}
            label={c.label}
            color={c.lcd}
            onClick={() =>
              navigate({ search: (p) => ({ ...p, cat: p.cat === c.id ? "" : c.id }) })
            }
          />
        ))}
      </div>

      {cat && CATEGORY_MAP[cat as CategoryId] ? (
        <p className="text-sm text-muted-foreground">{CATEGORY_MAP[cat as CategoryId].description}</p>
      ) : null}

      <p className="text-xs text-muted-foreground tabular-nums">{models.length} models</p>

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
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.description}</p>
              <p className="mt-3 font-mono text-[10px] text-muted-foreground">
                {m.params.slice(0, 6).join(" · ")}
              </p>
            </article>
          );
        })}
      </div>
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
