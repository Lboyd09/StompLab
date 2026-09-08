/**
 * Supabase / Neon poolers present a cert chain Node 22 rejects as
 * "self-signed certificate in certificate chain" when sslmode=require.
 * Keep TLS on; skip CA verification so research, admin, and auth can connect.
 *
 * node-pg uses the extended query protocol (unnamed prepared statements).
 * Supabase's transaction pooler (pgbouncer :6543) rejects those, so we
 * interpolate parameters and send simple-query text instead.
 *
 * Session pooler (:5432 on pooler.supabase.com) supports PREPARE but has a
 * tiny max-clients cap. Two Node pools (auth + app) plus concurrent lambdas
 * hit EMAXCONNSESSION and Admin looks "down". Prefer transaction :6543 and
 * share one Pool (max 1). The deploy migrator still uses session mode so a
 * whole multi-statement .sql file can run on one backend.
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

/** Transaction pooler multiplexes many serverless clients. Direct db.*:5432 is left alone. */
export function postgresPreferTransactionPooler(raw: string): string {
  const url = raw.trim();
  if (!url) return url;
  return url.replace(/(@[^@/?]*pooler\.supabase\.com):5432(?=\/|\?|$)/i, "$1:6543");
}

/** @deprecated Prefer postgresPreferTransactionPooler — kept so old tests/imports do not explode. */
export function postgresPreferSessionPooler(raw: string): string {
  return postgresPreferTransactionPooler(raw);
}

export function postgresConnectionString(raw: string): string {
  const url = postgresPreferTransactionPooler(raw.trim());
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
    rewritten: postgresPreferTransactionPooler(raw) !== raw,
  };
}

export function postgresPoolConfig(
  connectionString: string,
  extra?: {
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    query_timeout?: number;
    maxUses?: number;
  },
) {
  const resolved = postgresConnectionString(connectionString);
  return {
    connectionString: resolved,
    ssl: postgresSsl(resolved),
    // One client per isolate. Auth and the app share this pool (see pg-pool.ts).
    max: extra?.max ?? 1,
    idleTimeoutMillis: extra?.idleTimeoutMillis ?? 10_000,
    connectionTimeoutMillis: extra?.connectionTimeoutMillis ?? 3_000,
    query_timeout: extra?.query_timeout ?? 3_000,
    maxUses: extra?.maxUses ?? 1_000,
    allowExitOnIdle: true as const,
    application_name: "stomplab",
    keepAlive: true as const,
  };
}

/**
 * `NOT IN ($1,$2,…)` instead of `<> all($1::text[])`.
 * node-pg array params are the query that dies on a transaction pooler
 * unless interpolateSql runs first.
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

/** SQL literal for the simple-query protocol. Never pass untrusted identifiers through here. */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("sqlLiteral: invalid number");
    return String(value);
  }
  if (typeof value === "bigint") return String(value);
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return `'\\x${value.toString("hex")}'::bytea`;
  }
  if (value instanceof Uint8Array) {
    const hex = [...value].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `'\\x${hex}'::bytea`;
  }
  if (Array.isArray(value)) {
    if (!value.length) return "'{}'";
    return `ARRAY[${value.map(sqlLiteral).join(", ")}]`;
  }
  if (typeof value === "object") {
    return sqlLiteral(JSON.stringify(value));
  }
  return `'${String(value).replace(/\0/g, "").replace(/'/g, "''")}'`;
}

/** Replace $1, $2, … with literals so pgbouncer transaction mode can run the query. */
export function interpolateSql(text: string, params?: unknown[]): string {
  if (!params?.length) return text;
  return text.replace(/\$(\d+)\b/g, (match, n: string) => {
    const idx = Number(n) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= params.length) return match;
    return sqlLiteral(params[idx]);
  });
}

type QueryFn = (...args: unknown[]) => unknown;

function wrapQuery(orig: QueryFn): QueryFn {
  return function patched(this: unknown, queryTextOrConfig: unknown, values?: unknown, callback?: unknown) {
    if (
      queryTextOrConfig &&
      typeof queryTextOrConfig === "object" &&
      typeof (queryTextOrConfig as { submit?: unknown }).submit === "function"
    ) {
      return orig.call(this, queryTextOrConfig, values, callback);
    }
    if (typeof queryTextOrConfig === "string") {
      if (typeof values === "function") return orig.call(this, queryTextOrConfig, values);
      if (Array.isArray(values)) {
        const text = interpolateSql(queryTextOrConfig, values);
        if (typeof callback === "function") return orig.call(this, text, callback);
        return orig.call(this, text);
      }
      return orig.call(this, queryTextOrConfig, values, callback);
    }
    if (queryTextOrConfig && typeof queryTextOrConfig === "object") {
      const cfg = queryTextOrConfig as { text?: string; values?: unknown[] };
      const params = Array.isArray(values) ? values : cfg.values;
      if (cfg.text && (Array.isArray(params) || cfg.values)) {
        const next = { ...(cfg as object), text: interpolateSql(cfg.text, params ?? []) } as Record<string, unknown>;
        delete next.values;
        if (typeof values === "function") return orig.call(this, next, values);
        if (typeof callback === "function") return orig.call(this, next, callback);
        return orig.call(this, next);
      }
    }
    return orig.call(this, queryTextOrConfig, values, callback);
  };
}

function wrapClient(client: { query: QueryFn; __stomplabSimple?: boolean }) {
  if (client.__stomplabSimple) return;
  client.__stomplabSimple = true;
  client.query = wrapQuery(client.query.bind(client));
}

/**
 * Force simple-query text on Pool.query and on checked-out clients so Better
 * Auth (kysely acquireConnection) and tagged-template SQL both survive pgbouncer.
 */
export function patchPoolSimpleQuery<T extends { query: QueryFn; connect: QueryFn }>(pool: T): T {
  pool.query = wrapQuery(pool.query.bind(pool)) as T["query"];
  const origConnect = pool.connect.bind(pool);
  pool.connect = function patchedConnect(this: unknown, cb?: unknown) {
    if (typeof cb === "function") {
      return origConnect((err: unknown, client: { query: QueryFn } | undefined, release: unknown) => {
        if (client) wrapClient(client);
        (cb as (e: unknown, c: unknown, r: unknown) => void)(err, client, release);
      });
    }
    const result = origConnect();
    if (result && typeof (result as Promise<unknown>).then === "function") {
      return (result as Promise<{ query: QueryFn }>).then((client) => {
        wrapClient(client);
        return client;
      });
    }
    return result;
  } as T["connect"];
  return pool;
}

export function friendlyDbError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/egress|bandwidth|quota exceeded|exceeded the.*quota|over_quota|1028|storage quota/i.test(msg)) {
    return "Postgres is out of monthly bandwidth (egress). Pages still load; Admin stats and new cache writes wait until the quota resets.";
  }
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
    return "The pooler rejected a prepared query. Refresh Admin — Stomp Lab now sends simple SQL.";
  }
  if (/DATABASE_URL is missing/i.test(msg)) {
    return "DATABASE_URL is missing on the host, so Admin has no Postgres to read.";
  }
  return msg.slice(0, 220) || "Database error";
}
