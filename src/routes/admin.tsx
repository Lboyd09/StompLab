import { createFileRoute, Link, Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { adminDashboard, adminDeleteCache, adminInspectCache, probeResearchFn } from "@/lib/billing";
import { formatUsd } from "@/lib/plan";
import { parseStompModelId } from "@/data/types";
import type { Preset } from "@/data/types";
import { usePlan } from "@/lib/use-plan";
import { isAdminEmail } from "@/lib/plan";
import { useAppStore } from "@/store/app-store";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Dash = Awaited<ReturnType<typeof adminDashboard>>;
type Probe = Awaited<ReturnType<typeof probeResearchFn>>;

function AdminPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/admin") return <Outlet />;
  return <AdminDashboard />;
}

function AdminDashboard() {
  const { user, isPending } = useCurrentUserState();
  const { plan } = usePlan();
  const navigate = useNavigate();
  const savePreset = useAppStore((s) => s.savePreset);
  const setStompModel = useAppStore((s) => s.setStompModel);
  const [dash, setDash] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const [probe, setProbe] = useState<Probe | null>(null);
  const [probing, setProbing] = useState(false);
  const [gate, setGate] = useState<"wait" | "ok" | "no">("wait");
  const [authWaited, setAuthWaited] = useState(false);
  const [accountPage, setAccountPage] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setAuthWaited(true), 3500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const statsTimeout = window.setTimeout(() => {
      if (!cancelled) {
        setError((e) => e || "Stats timed out. Refresh to try again.");
      }
    }, 8000);
    void adminDashboard()
      .then((d) => {
        if (cancelled) return;
        window.clearTimeout(statsTimeout);
        setGate("ok");
        setDash(d);
        if (d.dbError) setError(d.dbError);
      })
      .catch((err) => {
        if (cancelled) return;
        window.clearTimeout(statsTimeout);
        const msg = err instanceof Error ? err.message : "Could not load admin.";
        if (/unauthorized/i.test(msg)) setGate("no");
        else setError(msg);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(statsTimeout);
    };
  }, [user?.id]);

  const adminUser = isAdminEmail(user?.primaryEmail) || plan.admin;

  if (!user && isPending && !authWaited) {
    return (
      <div className="space-y-3">
        <p className="sl-kicker">Hidden</p>
        <h1 className="sl-hero-title text-4xl">Admin</h1>
        <p className="text-sm text-muted-foreground">Checking your account…</p>
      </div>
    );
  }
  if (!user && isPending && authWaited) {
    return (
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Hidden</p>
        <h1 className="sl-hero-title text-3xl">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Sign-in is taking longer than usual. This page still opens once the session lands — wait, or
          sign in again.
        </p>
        <Link to="/login" search={{ next: "/admin" }} className="text-sm underline">
          Sign in again
        </Link>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" search={{ next: "/admin" }} />;
  if (!adminUser && gate === "wait") {
    return (
      <div className="space-y-3">
        <p className="sl-kicker">Hidden</p>
        <h1 className="sl-hero-title text-4xl">Admin</h1>
        <p className="text-sm text-muted-foreground">Checking your account…</p>
      </div>
    );
  }
  if (gate === "no" && !adminUser) {
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
      const result = await probeResearchFn();
      setProbe(result);
    } catch {
      setProbe(null);
      setError("Research did not answer.");
    } finally {
      setProbing(false);
    }
  }

  const accounts = dash?.accounts ?? [];
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(accounts.length / pageSize));
  const safePage = Math.min(accountPage, pageCount - 1);
  const accountRows = accounts.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Hidden</p>
        <h1 className="sl-hero-title text-4xl">Admin</h1>
        <p className="text-sm text-muted-foreground">{maskEmail(user.primaryEmail)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setError("");
              setDash(null);
              void adminDashboard()
                .then((d) => {
                  setDash(d);
                  if (d.dbError) setError(d.dbError);
                })
                .catch((err) => setError(err instanceof Error ? err.message : "Could not load admin."));
            }}
          >
            Refresh stats
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/erase">Erase a player</Link>
          </Button>
        </div>
      </header>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!dash && !error ? <p className="text-sm text-muted-foreground">Loading stats…</p> : null}

      {dash?.db ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Database</p>
          <p className="mt-2 font-display text-3xl font-semibold">{dash.db.ok ? "Connected" : "Down"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{dash.db.pingMs} ms</p>
          {dash.db.error ? <p className="mt-2 text-sm text-destructive">The database did not answer.</p> : null}
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Visitors today"
          value={String(dash?.visits?.today ?? "—")}
          hint="Unique browsers today. Your visits and /admin are not counted."
        />
        <Stat
          label="Visitors (7d)"
          value={String(dash?.visits?.d7 ?? "—")}
          hint="Unique browsers in the last 7 days."
        />
        <Stat
          label="Visitors (30d)"
          value={String(dash?.visits?.d30 ?? "—")}
          hint="Unique browsers in the last 30 days."
        />
        <Stat label="Signed up" value={String(dash?.userCount ?? "—")} hint="Player accounts. Your inbox is not included." />
        <Stat
          label="Subscribed"
          value={String(dash?.subscribedCount ?? "—")}
          hint="Paying players only. Test grants are not included."
        />
        <Stat
          label="Subscription revenue"
          value={dash ? formatUsd((dash.revenueCents ?? 0) / 100) : "—"}
          hint="Customer orders only. Test checkouts are not included."
        />
        <Stat
          label="Sign-ups (7d)"
          value={String(dash?.stats?.signups7d ?? "—")}
          hint={`${dash?.stats?.signups30d ?? 0} in the last 30 days. Same player list, shorter window.`}
        />
        <Stat
          label="Builds this month"
          value={String(dash?.stats?.buildsMonth ?? "—")}
          hint={`${dash?.stats?.buildsToday ?? 0} today. This calendar month on the server. Not the History list on a phone.`}
        />
        <Stat
          label="Conversion"
          value={dash ? `${dash.stats?.conversionPct ?? 0}%` : "—"}
          hint={`${dash?.stats?.freeUsers ?? 0} free · ${dash?.stats?.revoked ?? 0} revoked. Signed-up vs subscribed.`}
        />
        <Stat
          label="Est. MRR"
          value={dash ? formatUsd((dash.stats?.mrrCents ?? 0) / 100) : "—"}
          hint={`${formatUsd((dash?.stats?.arrCents ?? 0) / 100)} ARR · avg ${dash?.stats?.avgBuildsPaid ?? 0} builds this month / paid`}
        />
        <Stat
          label="Cache"
          value={String(dash?.stats?.cacheRows ?? "—")}
          hint={`${dash?.stats?.cacheHits ?? 0} hits · ${dash?.stats?.failures7d ?? 0} research failures in 7 days`}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Fold title="Top cached songs" count={(dash?.stats?.topSongs ?? []).length} defaultOpen={false}>
          <Table
            cols={["Song", "Hits"]}
            rows={(dash?.stats?.topSongs ?? []).map((r) => [r.song, String(r.n)])}
          />
        </Fold>
        <Fold title="Units" count={(dash?.stats?.deviceMix ?? []).length} defaultOpen>
          <Table
            cols={["Unit", "Rigs"]}
            rows={(dash?.stats?.deviceMix ?? []).map((r) => [r.stomp_model, String(r.n)])}
          />
        </Fold>
        <Fold title="Sign-ups by day" count={(dash?.stats?.signupsByDay ?? []).length} defaultOpen={false}>
          <Table
            cols={["Day", "N"]}
            rows={(dash?.stats?.signupsByDay ?? []).map((r) => [r.day, String(r.n)])}
          />
        </Fold>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Research</h2>
        <p className="text-sm text-muted-foreground">Checks that research answers. The key is not shown.</p>
        <Button type="button" variant="secondary" disabled={probing} onClick={() => void onProbe()}>
          {probing ? "Checking…" : "Ping research"}
        </Button>
        {probe ? (
          <p className="text-sm text-muted-foreground">
            {probe.configured ? "Research answered." : "Research did not answer."}
          </p>
        ) : null}
      </section>

      <Fold title="Accounts" count={accounts.length} defaultOpen={accounts.length > 0 && accounts.length <= 8}>
        <p className="text-sm text-muted-foreground">
          Player accounts only. Builds on this row are this calendar month. {pageSize} per page.
        </p>
        <Table
          cols={["When", "Email", "Name", "Paid", "Status", "Builds"]}
          rows={accountRows.map((a) => [
            localWhen(a.created_at),
            maskEmail(a.email),
            a.name,
            a.paid ? "yes" : "no",
            a.subscription_status || a.plan_interval || "free",
            String(a.builds),
          ])}
        />
        {pageCount > 1 ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <Button type="button" variant="secondary" size="sm" disabled={safePage <= 0} onClick={() => setAccountPage(safePage - 1)}>
              Previous
            </Button>
            <span className="tabular-nums text-muted-foreground">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setAccountPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </Fold>

      <Fold title="Purchases" count={(dash?.purchases ?? []).length} defaultOpen={(dash?.purchases ?? []).length <= 8}>
        <Table
          cols={["When", "Email", "Order", "Cents"]}
          rows={(dash?.purchases ?? []).map((p) => [
            localWhen(p.created_at),
            maskEmail(p.email),
            p.polar_order_id || p.polar_checkout_id,
            String(p.amount_cents),
          ])}
        />
      </Fold>

      <Fold title="Builds" count={(dash?.usage ?? []).length} defaultOpen={(dash?.usage ?? []).length <= 8}>
        <p className="text-sm text-muted-foreground">
          One row per player per month, about the last 100 days. This is not the History list on a device.
        </p>
        <Table
          cols={["User", "Email", "Month", "Count"]}
          rows={(dash?.usage ?? []).map((u) => [u.user_id.slice(0, 8), maskEmail(u.email), u.year_month, String(u.n)])}
        />
      </Fold>

      <Fold title="Failed researches" count={(dash?.failures ?? []).length} defaultOpen={(dash?.failures ?? []).length > 0 && (dash?.failures ?? []).length <= 8}>
        <Table
          cols={["When", "Song", "Artist", "Error"]}
          rows={(dash?.failures ?? []).map((f) => [localWhen(f.created_at), f.song, f.artist, f.error])}
        />
      </Fold>

      <Fold title="Feedback" count={(dash?.feedback ?? []).length} defaultOpen={(dash?.feedback ?? []).length > 0 && (dash?.feedback ?? []).length <= 6}>
        <p className="text-sm text-muted-foreground">
          Preset notes feed the next prompt. Do not retune songs one by one from this list.
        </p>
        <ul className="space-y-3">
          {(dash?.feedback ?? []).map((f, i) => (
            <li key={`${f.created_at}-${i}`} className="rounded-lg border border-border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{maskEmail(f.email) || "anon"}</span>
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
              <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{localWhen(f.created_at)}</p>
            </li>
          ))}
          {dash && dash.feedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : null}
        </ul>
      </Fold>

      <Fold title="Shared cache" count={(dash?.cache ?? []).length} defaultOpen={(dash?.cache ?? []).length > 0 && (dash?.cache ?? []).length <= 8}>
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
      </Fold>
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

function Fold({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left font-display text-lg font-semibold"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          {title}
          {count != null ? (
            <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">{count}</span>
          ) : null}
        </span>
        <span className="text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? <div className="max-h-[28rem] space-y-3 overflow-y-auto border-t border-border px-4 py-4">{children}</div> : null}
    </section>
  );
}

function maskEmail(email: string | null | undefined): string {
  const raw = (email ?? "").trim();
  const at = raw.indexOf("@");
  if (at < 1) return raw ? "—" : "—";
  return `${raw.slice(0, 1)}***@${raw.slice(at + 1)}`;
}

function localWhen(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
