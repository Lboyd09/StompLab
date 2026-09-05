/**
 * Supabase / Neon poolers present a cert chain Node 22 rejects as
 * "self-signed certificate in certificate chain" when sslmode=require.
 * Keep TLS on; skip CA verification so research, admin, and auth can connect.
 *
 * node-pg uses the extended query protocol (unnamed prepared statements).
 * Supabase's transaction pooler (:6543) cannot run those — admin aggregates
 * hang or return empty, Better Auth flakes, keepalive looks dead. Rewrite
 * pooler.supabase.com:6543 → :5432 (session mode) before connecting.
 */

export type PostgresPoolMode =
  | "local"
  | "supabase-session"
  | "supabase-transaction"
  | "remote"
  | "none";

export function postgresSsl(connectionString: string | undefined): false | { rejectUnauthorized: false } {
  const url = (connectionString ?? "").trim();
  if (!url || /localhost|127\.0\.0\.1/i.test(url)) return false;
  return { rejectUnauthorized: false };
}

/** Prefer the session pooler so parameterized SQL actually runs. */
export function postgresPreferSessionPooler(raw: string): string {
  const url = raw.trim();
  if (!url) return url;
  return url.replace(/(@[^@/?]*pooler\.supabase\.com):6543(?=\/|\?|$)/i, "$1:5432");
}

export function postgresConnectionString(raw: string): string {
  const url = postgresPreferSessionPooler(raw.trim());
  if (!url || /localhost|127\.0\.0\.1/i.test(url)) return url;
  if (/[?&]sslmode=/i.test(url)) {
    return url.replace(
      /([?&]sslmode=)(require|verify-full|verify-ca|prefer|allow|disable)/i,
      "$1no-verify",
    );
  }
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=no-verify`;
}

export function postgresPoolMode(connectionString: string | undefined): PostgresPoolMode {
  const url = (connectionString ?? "").trim();
  if (!url) return "none";
  if (/localhost|127\.0\.0\.1/i.test(url)) return "local";
  if (/pooler\.supabase\.com:6543/i.test(url)) return "supabase-transaction";
  if (/pooler\.supabase\.com/i.test(url)) return "supabase-session";
  return "remote";
}

/** Host:port only — never the user/password. */
export function postgresRedactedHost(connectionString: string | undefined): string {
  const url = (connectionString ?? "").trim();
  const m = url.match(/@([^/?]+)/);
  return m?.[1] ?? "";
}

export function postgresDescribe(connectionString: string | undefined): {
  mode: PostgresPoolMode;
  host: string;
  rewritten: boolean;
} {
  const raw = (connectionString ?? "").trim();
  if (!raw) return { mode: "none", host: "", rewritten: false };
  const next = postgresConnectionString(raw);
  return {
    mode: postgresPoolMode(next),
    host: postgresRedactedHost(next),
    rewritten: postgresPreferSessionPooler(raw) !== raw,
  };
}

export function postgresPoolConfig(
  connectionString: string,
  extra?: {
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    query_timeout?: number;
    statement_timeout?: number;
  },
) {
  const resolved = postgresConnectionString(connectionString);
  return {
    connectionString: resolved,
    ssl: postgresSsl(resolved),
    // Default 4 so admin can parallelize; auth still passes { max: 1 }.
    max: extra?.max ?? 4,
    idleTimeoutMillis: extra?.idleTimeoutMillis ?? 2000,
    connectionTimeoutMillis: extra?.connectionTimeoutMillis ?? 4000,
    query_timeout: extra?.query_timeout ?? 5000,
    statement_timeout: extra?.statement_timeout ?? 8000,
    allowExitOnIdle: true as const,
    application_name: "stomplab",
    options: "-c statement_timeout=8000",
  };
}

/**
 * `NOT IN ($1,$2,…)` instead of `<> all($1::text[])`.
 * node-pg array params are the query that dies on a transaction pooler.
 */
export function sqlNotInLower(
  columnSql: string,
  values: string[],
  startIndex = 1,
): { clause: string; params: string[] } {
  const params = [...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean))];
  if (!params.length) return { clause: "true", params: [] };
  const placeholders = params.map((_, i) => `$${startIndex + i}`).join(", ");
  return {
    clause: `lower(coalesce(${columnSql}, '')) not in (${placeholders})`,
    params,
  };
}

export function friendlyDbError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/self-signed|certificate|unable_to_verify|cert_/i.test(msg)) {
    return "The database connection was rejected (certificate). Refresh once — Stomp Lab now accepts the pooler's certificate.";
  }
  if (/EMAXCONN|max clients reached/i.test(msg)) {
    return "The database is busy or timed out. Refresh once — if it keeps happening, check the Supabase pooler.";
  }
  if (
    /timeout|timed out|statement_timeout|canceling statement|Connection terminated|ECONNRESET|ENOTFOUND|ECONNREFUSED|paused|remaining connection slots|Connection terminated unexpectedly/i.test(
      msg,
    )
  ) {
    return "Postgres did not answer in time. A free Supabase project may be waking up — wait 20 seconds and refresh Admin.";
  }
  if (/prepared statement|bind message|unnamed prepared|pgbouncer|in failed sql transaction/i.test(msg)) {
    return "The pooler rejected a prepared query. Stomp Lab now uses the session pooler — refresh Admin.";
  }
  if (/DATABASE_URL is missing/i.test(msg)) {
    return "DATABASE_URL is missing on the host, so Admin has no Postgres to read.";
  }
  return msg.slice(0, 220) || "Database error";
}
