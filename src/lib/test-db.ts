import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Sql, SqlTx } from "./db";

/**
 * In-process Postgres for node tests: PGLite with every file in `migrations/`
 * applied in order. Mirrors the result parsing in `db.ts` (int8 as number).
 * Tests only.
 */
export async function makeTestDb(): Promise<{ sql: Sql; tx: SqlTx; pg: PGlite }> {
  const pg = new PGlite({
    parsers: { 20: Number, 1082: (v: string) => v, 1186: (v: string) => v },
  });
  await pg.waitReady;
  const dir = new URL("../../migrations/", import.meta.url);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
  for (const file of files) {
    await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  }
  const wrap = (run: <T>(text: string, params: unknown[]) => Promise<T[]>): Sql => {
    const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      let text = strings[0];
      for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
      return run(text, values);
    }) as unknown as Sql;
    sql.query = (text: string, params: unknown[] = []) => run(text, params);
    return sql;
  };
  const sql = wrap(async <T>(text: string, params: unknown[]) => (await pg.query<T>(text, params)).rows);
  const tx: SqlTx = (fn) =>
    pg.transaction((t) =>
      fn(wrap(async <T>(text: string, params: unknown[]) => (await t.query<T>(text, params)).rows)),
    );
  return { sql, tx, pg };
}
