import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { adminDashboard, adminDeleteCache, adminInspectCache, probeResearchFn } from "@/lib/billing";
import { usePlan } from "@/lib/use-plan";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Dash = Awaited<ReturnType<typeof adminDashboard>>;
type Probe = Awaited<ReturnType<typeof probeResearchFn>>;
type Inspect = NonNullable<Awaited<ReturnType<typeof adminInspectCache>>["row"]>;

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const { plan, isPending: planPending } = usePlan();
  const [dash, setDash] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const [probe, setProbe] = useState<Probe | null>(null);
  const [probing, setProbing] = useState(false);
  const [inspect, setInspect] = useState<Inspect | null>(null);

  useEffect(() => {
    if (isPending || !user) return;
    adminDashboard()
      .then(setDash)
      .catch((err) => setError(err instanceof Error ? err.message : "Unauthorized"));
  }, [user, isPending]);

  if (isPending || planPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!user) return <Navigate to="/login" search={{ next: "/admin" }} />;
  if (!plan.admin) {
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
    if (inspect?.cache_key === key) setInspect(null);
    const next = await adminDashboard();
    setDash(next);
  }

  async function onOpen(key: string) {
    const res = await adminInspectCache({ data: { key } });
    setInspect(res.row);
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

  const preset = inspect?.preset as
    | {
        name?: string;
        summary?: string;
        originalGear?: { role: string; name: string }[];
        blocks?: { modelId: string }[];
      }
    | null
    | undefined;

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Hidden</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">{user.primaryEmail}</p>
      </header>

      {error && !dash ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Research backend</h2>
        <p className="text-sm text-muted-foreground">
          Checks Google AI Studio and the Vercel gateway. Never prints the key.
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
          Hidden from players. Open a song to make sure the chain is not stupid, then delete it if it is.
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
              <Button type="button" variant="secondary" size="sm" onClick={() => void onOpen(row.cache_key)}>
                Open
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
        {inspect ? (
          <div className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  {inspect.song} {inspect.artist ? `— ${inspect.artist}` : ""}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {inspect.instrument} · {inspect.stomp_model} · {inspect.hit_count} hits
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setInspect(null)}>
                Close
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{preset?.summary}</p>
            {preset?.originalGear?.length ? (
              <ul className="text-sm">
                {preset.originalGear.map((g) => (
                  <li key={`${g.role}-${g.name}`}>
                    <span className="text-muted-foreground">{g.role}: </span>
                    {g.name}
                  </li>
                ))}
              </ul>
            ) : null}
            {preset?.blocks?.length ? (
              <p className="font-mono text-xs text-muted-foreground">
                {preset.blocks.map((b) => b.modelId).join(" → ")}
              </p>
            ) : null}
            <pre className="max-h-80 overflow-auto rounded-md bg-secondary p-3 text-[11px] leading-relaxed">
              {JSON.stringify(inspect.preset, null, 2)}
            </pre>
            <Button type="button" variant="secondary" onClick={() => void onDelete(inspect.cache_key)}>
              Delete this cache
            </Button>
          </div>
        ) : null}
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
