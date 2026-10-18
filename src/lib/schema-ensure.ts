import type { Sql } from "./db";

/**
 * The security migrations (0014 to 0021) as idempotent single statements. The
 * migration files are the source of truth; this list runs the same DDL once per
 * process so a host that never ran `npm run db:migrate` still has the columns
 * the quota, webhook and feedback code reads. Keep it in step with those files.
 */
export const SECURITY_SCHEMA_STATEMENTS: string[] = [
  `alter table feedback add column if not exists approved_at timestamptz`,
  `alter table feedback add column if not exists rejected_at timestamptz`,
  `alter table build_events add column if not exists status text not null default 'confirmed'`,
  `create index if not exists build_events_status_idx on build_events (user_id, status, created_at)`,
  `create table if not exists polar_webhook_events (
     webhook_id text primary key,
     event_type text not null default '',
     received_at timestamptz not null default now()
   )`,
  `alter table entitlements add column if not exists polar_event_at timestamptz`,
  `create table if not exists rate_limit_hits (
     id bigserial primary key,
     bucket text not null,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists rate_limit_hits_bucket_idx on rate_limit_hits (bucket, created_at)`,
  `alter table rig_cache add column if not exists bpm integer`,
  `create table if not exists shared_presets (
     share_id text primary key,
     user_id text not null,
     preset jsonb not null,
     song text,
     artist text,
     stomp_model text,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists shared_presets_user_idx on shared_presets (user_id, created_at)`,
  `alter table feedback add column if not exists context jsonb`,
  `update entitlements e
   set user_id = m.id, updated_at = now()
   from (
     select lower(u.email) as em, min(u.id) as id
     from "user" u
     group by lower(u.email)
     having count(*) = 1
   ) m
   where lower(e.email) = m.em
     and e.email <> ''
     and not exists (select 1 from "user" x where x.id = e.user_id)
     and not exists (select 1 from entitlements o where o.user_id = m.id)
     and (
       select count(*) from entitlements e2
       where lower(e2.email) = m.em
         and not exists (select 1 from "user" x2 where x2.id = e2.user_id)
     ) = 1`,
];

const g = globalThis as typeof globalThis & { __stompSecuritySchema__?: Promise<void> };

export function ensureSecuritySchema(sql: Sql): Promise<void> {
  g.__stompSecuritySchema__ ??= (async () => {
    for (const statement of SECURITY_SCHEMA_STATEMENTS) {
      try {
        await sql.query(statement);
      } catch (err) {
        console.error("[db] schema ensure step failed", err instanceof Error ? err.message : err);
      }
    }
  })();
  return g.__stompSecuritySchema__;
}
