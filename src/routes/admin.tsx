import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { adminDashboard, adminDeleteCache, adminInspectCache, probeResearchFn, requireAdmin } from "@/lib/billing";
import { AFFILIATE_SETUP } from "@/lib/copy";
import { formatUsd } from "@/lib/plan";
import { parseStompModelId } from "@/data/types";
import type { Preset } from "@/data/types";
import { usePlan } from "@/lib/use-plan";
import { useAppStore } from "@/store/app-store";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Dash = Awaited<ReturnType<typeof adminDashboard>>;
type Probe = Awaited<ReturnType<typeof probeResearchFn>>;

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const { plan, isPending: planPending } = usePlan();
  const navigate = useNavigate();
  const savePreset = useAppStore((s) => s.savePreset);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const [dash, setDash] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const [probe, setProbe] = useState<Probe | null>(null);
  const [probing, setProbing] = useState(false);
  const [gate, setGate] = useState<"wait" | "ok" | "no">("wait");

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    void Promise.all([
      requireAdmin()
        .then(() => true)
        .catch(() => false),
      adminDashboard()
        .then((d) => {
          if (!cancelled) setDash(d);
          return true;
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not load admin.");
          return false;
        }),
    ]).then(([ok]) => {
      if (cancelled) return;
      setGate(ok ? "ok" : "no");
    });
    return () => {
      cancelled = true;
    };
  }, [user, isPending]);

  if (isPending || planPending || gate === "wait") return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!user) return <Navigate to="/login" search={{ next: "/admin" }} />;
  if (gate === "no" && !plan.admin) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">Not found</h1>
        <Link to="/" className="text-sm underline">
          Lab
        </Link>
      </div>
    );
  }

  async function onDelete(key: string) {
    await adminDeleteCache({ data: { key } });
    const next = await adminDashboard();
    setDash(next);
  }

  async function onOpenReplica(key: string) {
    const res = await adminInspectCache({ data: { key } });
    const raw = res.row?.preset as Preset | null | undefined;
    if (!raw || !Array.isArray(raw.blocks) || !raw.blocks.length) return;
    const model = parseStompModelId(res.row?.stomp_model ?? raw.stompModel);
    const playable: Preset = {
      ...raw,
      id: raw.id && !raw.id.startsWith("cache-") ? raw.id : `cache-${key.slice(0, 24)}`,
      createdAt: Date.now(),
      stompModel: model,
    };
    setStompModel(model);
    savePreset(playable);
    await navigate({ to: "/preset/$id", params: { id: playable.id } });
  }

  async function onProbe() {
    setProbing(true);
    try {
      setProbe(await probeResearchFn());
    } catch (err) {
      setProbe({
        configured: false,
        google: "error",
        gateway: "error",
        detail: err instanceof Error ? err.message : "Probe failed",
      });
    } finally {
      setProbing(false);
    }
  }

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Hidden</p>
        <h1 className="font-display text-4xl font-semibold uppercase leading-[0.9] tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">{user.primaryEmail}</p>
      </header>

      {error && !dash ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Signed up" value={String(dash?.userCount ?? "—")} hint="Every account except yours" />
        <Stat
          label="Subscribed"
          value={String(dash?.subscribedCount ?? "—")}
          hint="Polar-paid customers only — your admin grant and Polar tests are excluded"
        />
        <Stat
          label="Subscription revenue"
          value={dash ? formatUsd((dash.revenueCents ?? 0) / 100) : "—"}
          hint="Customer Polar orders only. Tests, unmatched Polar rows, and your inboxes never show. $0 until someone else pays."
        />
        <Stat
          label="Affiliate clicks"
          value={String((dash?.affiliateClicks ?? []).reduce((n, r) => n + r.n, 0))}
          hint="Amazon — commissions live on the Associates dashboard"
        />
        <Stat
          label="Sign-ups (7d)"
          value={String(dash?.stats?.signups7d ?? "—")}
          hint={`${dash?.stats?.signups30d ?? 0} in the last 30 days`}
        />
        <Stat
          label="Builds this month"
          value={String(dash?.stats?.buildsMonth ?? "—")}
          hint={`${dash?.stats?.buildsToday ?? 0} today`}
        />
        <Stat
          label="Conversion"
          value={dash ? `${dash.stats?.conversionPct ?? 0}%` : "—"}
          hint={`${dash?.stats?.freeUsers ?? 0} free · ${dash?.stats?.revoked ?? 0} revoked`}
        />
        <Stat
          label="Est. MRR"
          value={dash ? formatUsd((dash.stats?.mrrCents ?? 0) / 100) : "—"}
          hint={`${formatUsd((dash?.stats?.arrCents ?? 0) / 100)} ARR · avg ${dash?.stats?.avgBuildsPaid ?? 0} builds / paid`}
        />
        <Stat
          label="Cache"
          value={String(dash?.stats?.cacheRows ?? "—")}
          hint={`${dash?.stats?.cacheHits ?? 0} hits · ${dash?.stats?.failures7d ?? 0} research failures (7d)`}
        />
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Money setup</h2>
        <ul className="space-y-1 text-sm">
          <li>Polar products: {dash?.polarReady ? "ready" : "missing POLAR_PRODUCT_ID_MONTHLY / YEARLY"}</li>
          <li>Amazon tag: {dash?.amazonReady ? "set" : "missing VITE_AMAZON_ASSOCIATE_TAG"}</li>
        </ul>
        {(dash?.affiliateClicks ?? []).length ? (
          <Table
            cols={["Vendor", "Clicks"]}
            rows={(dash?.affiliateClicks ?? []).map((r) => [r.vendor, String(r.n)])}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No affiliate clicks yet.</p>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">{AFFILIATE_SETUP}</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Top cached songs</h2>
          <Table
            cols={["Song", "Hits"]}
            rows={(dash?.stats?.topSongs ?? []).map((r) => [r.song, String(r.n)])}
          />
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Units</h2>
          <Table
            cols={["Unit", "Rigs"]}
            rows={(dash?.stats?.deviceMix ?? []).map((r) => [r.stomp_model, String(r.n)])}
          />
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Sign-ups by day</h2>
          <Table
            cols={["Day", "N"]}
            rows={(dash?.stats?.signupsByDay ?? []).map((r) => [r.day, String(r.n)])}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Research backend</h2>
        <p className="text-sm text-muted-foreground">
          Checks Google AI Studio and the research gateway. Never prints the key.
        </p>
        <Button type="button" variant="secondary" disabled={probing} onClick={() => void onProbe()}>
          {probing ? "Checking…" : "Ping research"}
        </Button>
        {probe ? (
          <ul className="space-y-1 text-sm">
            <li>Google: {probe.google}</li>
            <li>Gateway: {probe.gateway}</li>
            <li className="text-muted-foreground">{probe.detail}</li>
          </ul>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Accounts</h2>
        <p className="text-sm text-muted-foreground">New sign-ups, plan, and how many custom builds they have used.</p>
        <Table
          cols={["When", "Email", "Name", "Paid", "Status", "Builds"]}
          rows={(dash?.accounts ?? []).map((a) => [
            a.created_at,
            a.email,
            a.name,
            a.paid ? "yes" : "no",
            a.subscription_status || a.plan_interval || "free",
            String(a.builds),
          ])}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Purchases</h2>
        <Table
          cols={["When", "Email", "Order", "Cents"]}
          rows={(dash?.purchases ?? []).map((p) => [
            p.created_at,
            p.email,
            p.polar_order_id || p.polar_checkout_id,
            String(p.amount_cents),
          ])}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Builds</h2>
        <Table
          cols={["User", "Email", "Month", "Count"]}
          rows={(dash?.usage ?? []).map((u) => [u.user_id.slice(0, 8), u.email, u.year_month, String(u.n)])}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Failed researches</h2>
        <Table
          cols={["When", "Song", "Artist", "Error"]}
          rows={(dash?.failures ?? []).map((f) => [f.created_at, f.song, f.artist, f.error])}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Feedback</h2>
        <p className="text-sm text-muted-foreground">
          Preset notes feed the next prompt. Do not retune songs one by one from this list.
        </p>
        <ul className="space-y-3">
          {(dash?.feedback ?? []).map((f, i) => (
            <li key={`${f.created_at}-${i}`} className="rounded-lg border border-border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{f.email || "anon"}</span>
                <span className="text-xs text-muted-foreground">
                  {f.kind}
                  {f.song ? ` · ${f.song}` : ""}
                  {f.rating ? ` · ${f.rating}/5` : ""}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{f.message}</p>
              {f.closer_tweaks ? (
                <p className="mt-2 text-xs">
                  <span className="font-medium text-foreground">Changed: </span>
                  {f.closer_tweaks}
                </p>
              ) : null}
              {f.want_preset ? (
                <p className="mt-1 text-xs">
                  <span className="font-medium text-foreground">Want in preset: </span>
                  {f.want_preset}
                </p>
              ) : null}
              {f.want_app ? (
                <p className="mt-1 text-xs">
                  <span className="font-medium text-foreground">Want in app: </span>
                  {f.want_app}
                </p>
              ) : null}
              <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{f.created_at}</p>
            </li>
          ))}
          {dash && dash.feedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : null}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Shared cache</h2>
        <p className="text-sm text-muted-foreground">
          Hidden from players. Open a song on the replica — same visual page players use.
        </p>
        <ul className="space-y-2">
          {(dash?.cache ?? []).map((row) => (
            <li
              key={row.cache_key}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {row.song} {row.artist ? `— ${row.artist}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.instrument} · {row.stomp_model} · {row.hit_count} hits
                  {row.summary ? ` · ${row.summary.slice(0, 80)}` : ""}
                </div>
              </div>
              <Button type="button" size="sm" onClick={() => void onOpenReplica(row.cache_key)}>
                Replica
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => void onDelete(row.cache_key)}>
                Delete
              </Button>
            </li>
          ))}
          {dash && dash.cache.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cached rigs yet.</p>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function Table({ cols, rows }: { cols: string[]; rows: string[][] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">None yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => (
                <td key={j} className="max-w-xs truncate px-3 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
