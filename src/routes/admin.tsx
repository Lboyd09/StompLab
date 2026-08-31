import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { adminDashboard, adminDeleteCache } from "@/lib/billing";
import { isAdminEmail } from "@/lib/plan";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Dash = Awaited<ReturnType<typeof adminDashboard>>;

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const [dash, setDash] = useState<Dash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isPending || !user) return;
    adminDashboard()
      .then(setDash)
      .catch((err) => setError(err instanceof Error ? err.message : "Unauthorized"));
  }, [user, isPending]);

  if (isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!user) return <Navigate to="/login" search={{ next: "/admin" }} />;
  if (!isAdminEmail(user.primaryEmail) && error) {
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

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Hidden</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">{user.primaryEmail}</p>
      </header>

      {error && !dash ? <p className="text-sm text-destructive">{error}</p> : null}

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
        <h2 className="font-display text-lg font-semibold">Shared cache</h2>
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
                </div>
              </div>
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
