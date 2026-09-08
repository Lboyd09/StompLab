import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  friendlyDbError,
  interpolateSql,
  postgresConnectionString,
  postgresDescribe,
  postgresPoolConfig,
  postgresPoolMode,
  postgresPreferTransactionPooler,
  postgresSsl,
  sqlLiteral,
  sqlNotInLower,
} from "./postgres-ssl.ts";

describe("postgresConnectionString", () => {
  it("leaves loopback URLs alone", () => {
    const local = "postgres://u:p@localhost:5432/db";
    assert.equal(postgresConnectionString(local), local);
    assert.equal(postgresSsl(local), false);
  });
  it("adds sslmode=no-verify when missing", () => {
    assert.equal(
      postgresConnectionString("postgres://u:p@db.example.com:5432/postgres"),
      "postgres://u:p@db.example.com:5432/postgres?sslmode=no-verify",
    );
  });
  it("rewrites require/verify-full so Node does not reject the pooler CA", () => {
    assert.match(
      postgresConnectionString("postgres://u:p@db.example.com:5432/postgres?sslmode=require"),
      /sslmode=no-verify/,
    );
    assert.match(
      postgresConnectionString("postgres://u:p@db.example.com:5432/postgres?sslmode=verify-full"),
      /sslmode=no-verify/,
    );
  });
  it("enables TLS without verifying the pooler CA", () => {
    assert.deepEqual(postgresSsl("postgres://u:p@db.supabase.co:5432/postgres"), {
      rejectUnauthorized: false,
    });
  });
  it("maps the self-signed chain error to a short line", () => {
    assert.match(friendlyDbError(new Error("self-signed certificate in certificate chain")), /certificate/i);
  });
  it("maps a hang/timeout to a wake-up line", () => {
    assert.match(friendlyDbError(new Error("timeout expired")), /waking/i);
    assert.match(friendlyDbError(new Error("Connection terminated due to connection timeout")), /waking/i);
    assert.match(friendlyDbError(new Error("canceling statement due to statement_timeout")), /waking|timed out|busy/i);
  });
  it("maps pool busy to a short line", () => {
    assert.match(friendlyDbError(new Error("(EMAXCONNSESSION) max clients reached")), /busy|pooler/i);
  });
  it("maps egress quota to a short line", () => {
    assert.match(friendlyDbError(new Error("egress quota exceeded")), /bandwidth|egress/i);
  });
  it("maps prepared-statement failures to the simple-SQL line", () => {
    assert.match(friendlyDbError(new Error("unnamed prepared statement does not exist")), /simple SQL/i);
  });
});

describe("postgresPreferTransactionPooler", () => {
  it("rewrites Supabase session :5432 to transaction :6543", () => {
    const raw =
      "postgres://postgres.abc:secret@aws-0-us-west-1.pooler.supabase.com:5432/postgres";
    const next = postgresPreferTransactionPooler(raw);
    assert.match(next, /pooler\.supabase\.com:6543/);
    assert.doesNotMatch(next, /:5432/);
    assert.match(postgresConnectionString(raw), /sslmode=no-verify/);
    assert.match(postgresConnectionString(raw), /:6543/);
    assert.equal(postgresPoolMode(raw), "supabase-session");
    assert.equal(postgresPoolMode(next), "supabase-transaction");
  });
  it("leaves a transaction-pooler URL on 6543 alone", () => {
    const raw = "postgres://postgres.abc:secret@aws-0-us-west-1.pooler.supabase.com:6543/postgres";
    assert.equal(postgresPreferTransactionPooler(raw), raw);
    assert.equal(postgresPoolMode(postgresConnectionString(raw).replace(/\?.*$/, "")), "supabase-transaction");
  });
  it("does not rewrite a non-Supabase :5432 host", () => {
    const raw = "postgres://u:p@db.example.com:5432/postgres";
    assert.equal(postgresPreferTransactionPooler(raw), raw);
  });
  it("does not rewrite a direct db.xxx.supabase.co host", () => {
    const raw = "postgres://postgres:secret@db.abc.supabase.co:5432/postgres";
    assert.equal(postgresPreferTransactionPooler(raw), raw);
  });
  it("describes the rewritten host without the password", () => {
    const raw =
      "postgres://postgres.abc:super-secret@aws-0-us-west-1.pooler.supabase.com:5432/postgres";
    const d = postgresDescribe(raw);
    assert.equal(d.rewritten, true);
    assert.equal(d.mode, "supabase-transaction");
    assert.equal(d.host, "aws-0-us-west-1.pooler.supabase.com:6543");
    assert.doesNotMatch(d.host, /secret/);
  });
  it("puts query timeout on the pool and does not send startup options", () => {
    const cfg = postgresPoolConfig("postgres://u:p@db.example.com:5432/postgres");
    assert.equal(cfg.query_timeout, 8_000);
    assert.equal(cfg.connectionTimeoutMillis, 8_000);
    assert.equal(cfg.application_name, "stomplab");
    assert.equal("options" in cfg, false);
    assert.equal(cfg.max, 1);
    assert.equal(cfg.idleTimeoutMillis, 10_000);
    assert.equal(cfg.maxUses, 1_000);
  });
});

describe("sqlNotInLower", () => {
  it("builds a NOT IN list of individual $n params", () => {
    const { clause, params } = sqlNotInLower("email", ["A@X.com", "b@y.com", "a@x.com", ""]);
    assert.equal(clause, "lower(coalesce(email, '')) not in ($1, $2)");
    assert.deepEqual(params, ["a@x.com", "b@y.com"]);
  });
  it("offsets placeholders when mixed with earlier params", () => {
    const { clause, params } = sqlNotInLower("u.email", ["owner@x.com"], 2);
    assert.equal(clause, "lower(coalesce(u.email, '')) not in ($2)");
    assert.deepEqual(params, ["owner@x.com"]);
  });
  it("is true when the list is empty", () => {
    const { clause, params } = sqlNotInLower("email", []);
    assert.equal(clause, "true");
    assert.deepEqual(params, []);
  });
});

describe("postgresPoolConfig", () => {
  it("defaults max to 1 with no pgbouncer-hostile startup options", () => {
    const cfg = postgresPoolConfig("postgres://u:p@db.supabase.co:6543/postgres");
    assert.equal(cfg.max, 1);
    assert.equal(cfg.idleTimeoutMillis, 10_000);
    assert.equal(cfg.connectionTimeoutMillis, 8_000);
    assert.equal("options" in cfg, false);
    assert.equal(postgresPoolConfig("postgres://u:p@db.supabase.co:6543/postgres", { max: 2 }).max, 2);
  });
});

describe("interpolateSql", () => {
  it("quotes strings and doubles apostrophes", () => {
    assert.equal(sqlLiteral("o'reilly"), "'o''reilly'");
    assert.equal(interpolateSql("select * from t where email = $1", ["a@b.com"]), "select * from t where email = 'a@b.com'");
  });
  it("handles null, bool, number, and empty array", () => {
    assert.equal(sqlLiteral(null), "NULL");
    assert.equal(sqlLiteral(true), "TRUE");
    assert.equal(sqlLiteral(12), "12");
    assert.equal(sqlLiteral([]), "'{}'");
  });
  it("interpolates text arrays so any($1::text[]) survives pgbouncer", () => {
    const sql = interpolateSql("select id from t where id = any($1::text[])", [["a", "b"]]);
    assert.equal(sql, "select id from t where id = any(ARRAY['a', 'b']::text[])");
  });
  it("does not confuse $1 with $10", () => {
    const sql = interpolateSql("select $1, $10, $2", ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
    assert.equal(sql, "select 'a', 'j', 'b'");
  });
  it("JSON-stringifies objects for jsonb columns", () => {
    assert.equal(interpolateSql("insert into t (p) values ($1::jsonb)", [{ a: 1 }]), `insert into t (p) values ('{"a":1}'::jsonb)`);
  });
  it("is a no-op without params", () => {
    assert.equal(interpolateSql("select 1"), "select 1");
    assert.equal(interpolateSql("select 1", []), "select 1");
  });
});
