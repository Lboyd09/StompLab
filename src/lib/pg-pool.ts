/**
 * One node-pg Pool for the whole isolate — Better Auth and app SQL share it.
 * Two pools against the session pooler is how Admin hit EMAXCONNSESSION.
 */
import { Pool, types } from "pg";
import { patchPoolSimpleQuery, postgresPoolConfig } from "./postgres-ssl";

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;

types.setTypeParser(OID_INT8, Number);
types.setTypeParser(OID_DATE, (v) => v);
types.setTypeParser(OID_INTERVAL, (v) => v);

const g = globalThis as typeof globalThis & { __stomplabPgPool__?: Pool };

export function getAppPool(connectionString: string): Pool {
  if (g.__stomplabPgPool__) return g.__stomplabPgPool__;
  const pool = new Pool(postgresPoolConfig(connectionString));
  patchPoolSimpleQuery(pool);
  pool.on("error", (err) => {
    console.error("[db] idle client", err instanceof Error ? err.message : err);
  });
  g.__stomplabPgPool__ = pool;
  return pool;
}
