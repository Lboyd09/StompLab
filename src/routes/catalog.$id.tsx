import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_MAP } from "@/data/categories";
import { aliasesForModel, devicesForModel, MODEL_MAP } from "@/data/catalog";
import { helixIdFor, UNEXPORTABLE_MODELS } from "@/data/helix-ids";
import { Mark } from "@/components/layout/mark";

export const Route = createFileRoute("/catalog/$id")({ component: CatalogModelPage });

function CatalogModelPage() {
  const { id } = Route.useParams();
  const model = MODEL_MAP[id];
  if (!model) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
        <Mark size="md" className="mx-auto" />
        <h1 className="sl-hero-title text-3xl">That model isn’t in the catalog.</h1>
        <p className="text-sm text-muted-foreground">Factory Line 6 names only — no custom IRs or user models.</p>
        <Link to="/catalog" search={{ q: "", cat: "", tab: "browse", unit: "" }} className="text-sm underline underline-offset-2">
          Back to the catalog
        </Link>
      </div>
    );
  }

  const cat = CATEGORY_MAP[model.category];
  const units = devicesForModel(model);
  const aliases = aliasesForModel(model.id);
  const factoryId = helixIdFor(model.id);
  const exportable = Boolean(factoryId) && !UNEXPORTABLE_MODELS.has(model.id);

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <PageHeader kicker={cat.label} title={model.name}>
        Line 6 factory model. Based on {model.basedOn}.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: cat.lcd }} />
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{cat.label}</span>
        {model.io === "legacy" ? <Badge variant="outline">Legacy</Badge> : null}
        {model.dsp === "heavy" ? <Badge variant="outline">Heavy DSP</Badge> : null}
        {model.instrument !== "both" ? <Badge variant="outline">{model.instrument}</Badge> : null}
        {!exportable ? <Badge variant="outline">Not in .hlx export</Badge> : null}
      </div>

      <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">{model.description}</p>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">On these units</h2>
        <p className="text-sm text-muted-foreground">
          Factory list for each Line 6 unit we write presets for. HX Effects never has amps or cabs. POD Go skips
          poly pitch models.
        </p>
        {units.length ? (
          <ul className="flex flex-wrap gap-2">
            {units.map((d) => (
              <li key={d.id}>
                <Link
                  to="/catalog"
                  search={{ q: "", cat: model.category, tab: "browse", unit: d.id }}
                  className="inline-flex h-9 items-center rounded-full bg-secondary px-3 text-xs font-medium"
                >
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Not on the current factory export list.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Knobs</h2>
        <p className="font-mono text-sm text-muted-foreground">{model.params.join(" · ")}</p>
      </section>

      {aliases.length ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold">People type</h2>
          <p className="text-sm text-muted-foreground">Real-world names that map here.</p>
          <ul className="flex flex-wrap gap-2">
            {aliases.map((a) => (
              <li key={a} className="rounded-full bg-secondary px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {a}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Catalog id <span className="font-mono">{model.id}</span>
        {factoryId ? (
          <>
            {" "}
            · factory <span className="font-mono">{factoryId}</span>
          </>
        ) : null}
      </p>

      <p>
        <Link
          to="/catalog"
          search={{ q: "", cat: model.category, tab: "browse", unit: "" }}
          className="text-sm underline underline-offset-2"
        >
          All {cat.label.toLowerCase()} models
        </Link>
      </p>
    </div>
  );
}
