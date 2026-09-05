/**
 * Supabase / Neon poolers present a cert chain Node 22 rejects as
 * "self-signed certificate in certificate chain" when sslmode=require.
 * Keep TLS on; skip CA verification so research, admin, and auth can connect.
 */

export function postgresSsl(connectionString: string | undefined): false | { rejectUnauthorized: false } {
  const url = (connectionString ?? "").trim();
  if (!url || /localhost|127\.0\.0\.1/i.test(url)) return false;
  return { rejectUnauthorized: false };
}

export function postgresConnectionString(raw: string): string {
  const url = raw.trim();
  if (!url || /localhost|127\.0\.0\.1/i.test(url)) return url;
  if (/[?&]sslmode=/i.test(url)) {
    return url.replace(
      /([?&]sslmode=)(require|verify-full|verify-ca|prefer|allow|disable)/i,
      "$1no-verify",
    );
  }
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=no-verify`;
}

export function postgresPoolConfig(
  connectionString: string,
  extra?: { max?: number; idleTimeoutMillis?: number; connectionTimeoutMillis?: number },
) {
  return {
    connectionString: postgresConnectionString(connectionString),
    ssl: postgresSsl(connectionString),
    // Serverless: one client per isolate. Session pooler caps ~15; greedier pools hang admin.
    max: extra?.max ?? 1,
    idleTimeoutMillis: extra?.idleTimeoutMillis ?? 2000,
    connectionTimeoutMillis: extra?.connectionTimeoutMillis ?? 4000,
    allowExitOnIdle: true as const,
    // Cap any single query so adminDashboard cannot sit pending forever.
    options: "-c statement_timeout=8000",
  };
}

export function friendlyDbError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/self-signed|certificate|unable_to_verify|cert_/i.test(msg)) {
    return "The database connection was rejected (certificate). Refresh once — Stomp Lab now accepts the pooler's certificate.";
  }
  if (/timeout|EMAXCONN|max clients|statement_timeout|canceling statement/i.test(msg)) {
    return "The database is busy or timed out. Refresh once — if it keeps happening, check the Supabase pooler.";
  }
  return msg.slice(0, 220) || "Database error";
}
