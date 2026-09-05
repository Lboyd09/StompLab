import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  friendlyDbError,
  postgresConnectionString,
  postgresDescribe,
  postgresPoolConfig,
  postgresPoolMode,
  postgresPreferSessionPooler,
  postgresSsl,
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
  it("maps prepared-statement failures to the session-pooler line", () => {
    assert.match(friendlyDbError(new Error("unnamed prepared statement does not exist")), /session pooler/i);
  });
});

describe("postgresPreferSessionPooler", () => {
  it("rewrites Supabase transaction :6543 to session :5432", () => {
    const raw =
      "postgres://postgres.abc:secret@aws-0-us-west-1.pooler.supabase.com:6543/postgres";
    const next = postgresPreferSessionPooler(raw);
    assert.match(next, /pooler\.supabase\.com:5432/);
    assert.doesNotMatch(next, /:6543/);
    assert.match(postgresConnectionString(raw), /sslmode=no-verify/);
    assert.match(postgresConnectionString(raw), /:5432/);
    assert.equal(postgresPoolMode(raw), "supabase-transaction");
    assert.equal(postgresPoolMode(next), "supabase-session");
  });
  it("leaves a session-pooler URL on 5432 alone", () => {
    const raw = "postgres://postgres.abc:secret@aws-0-us-west-1.pooler.supabase.com:5432/postgres";
    assert.equal(postgresPreferSessionPooler(raw), raw);
  });
  it("does not rewrite a non-Supabase :6543 host", () => {
    const raw = "postgres://u:p@db.example.com:6543/postgres";
    assert.equal(postgresPreferSessionPooler(raw), raw);
  });
  it("describes the rewritten host without the password", () => {
    const raw =
      "postgres://postgres.abc:super-secret@aws-0-us-west-1.pooler.supabase.com:6543/postgres";
    const d = postgresDescribe(raw);
    assert.equal(d.rewritten, true);
    assert.equal(d.mode, "supabase-session");
    assert.equal(d.host, "aws-0-us-west-1.pooler.supabase.com:5432");
    assert.doesNotMatch(d.host, /secret/);
  });
  it("puts query and statement timeouts on the pool", () => {
    const cfg = postgresPoolConfig("postgres://u:p@db.example.com:5432/postgres");
    assert.equal(cfg.query_timeout, 5000);
    assert.equal(cfg.statement_timeout, 8000);
    assert.equal(cfg.connectionTimeoutMillis, 4000);
    assert.equal(cfg.application_name, "stomplab");
    assert.equal(cfg.options, "-c statement_timeout=8000");
    assert.equal(cfg.max, 4);
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
  it("defaults max to 4; auth can still pass max: 1", () => {
    const cfg = postgresPoolConfig("postgres://u:p@db.supabase.co:6543/postgres");
    assert.equal(cfg.max, 4);
    assert.equal(cfg.idleTimeoutMillis, 2000);
    assert.equal(cfg.connectionTimeoutMillis, 4000);
    assert.equal(cfg.options, "-c statement_timeout=8000");
    assert.equal(postgresPoolConfig("postgres://u:p@db.supabase.co:6543/postgres", { max: 1 }).max, 1);
  });
});
