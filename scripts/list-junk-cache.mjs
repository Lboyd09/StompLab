#!/usr/bin/env node
/**
 * Lists rig_cache rows for junk or unverifiable song titles.
 * Read-only. Does not delete anything.
 *
 * Usage: DATABASE_URL=... node scripts/list-junk-cache.mjs
 * With no DATABASE_URL, prints the SQL and exits.
 */
import pg from "pg";

const TITLES = [
  "zzzxqv",
  "the quantum refrigerator at 3am",
  "paper lanterns of mars",
  "hhshhhhhhhhhaahhahhshs",
  "hhshhs",
];

const sqlText = `
select cache_key, song, artist, instrument, stomp_model, hit_count, created_at
from rig_cache
where kind = 'song'
  and (
    lower(song) like '%zzzxqv%'
    or lower(song) like '%quantum refrigerator%'
    or lower(song) like '%paper lanterns of mars%'
    or lower(song) like '%hhshhs%'
    or song ~ '(.)\\1{4,}'
  )
order by updated_at desc
limit 200;
`;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("DATABASE_URL is not set. SQL to run by hand:");
  console.log(sqlText);
  console.log("Known junk titles:", TITLES.join(", "));
  process.exit(0);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const res = await client.query(sqlText);
  if (!res.rows.length) {
    console.log("No matching cache rows.");
  } else {
    for (const row of res.rows) {
      console.log(
        [row.cache_key, row.song, row.artist, row.stomp_model, `hits=${row.hit_count}`].filter(Boolean).join(" | "),
      );
    }
    console.log(`${res.rows.length} row(s). Delete from admin if they should not stay cached.`);
  }
} finally {
  await client.end();
}
