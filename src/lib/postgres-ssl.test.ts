import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { friendlyDbError, postgresConnectionString, postgresPoolConfig, postgresSsl } from "./postgres-ssl.ts";

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
  it("maps pool busy / statement timeout to a short line", () => {
    assert.match(friendlyDbError(new Error("canceling statement due to statement_timeout")), /timed out|busy/i);
    assert.match(friendlyDbError(new Error("(EMAXCONNSESSION) max clients reached")), /busy|pooler/i);
  });
});

describe("postgresPoolConfig", () => {
  it("defaults max to 4 for the transaction pooler; auth can still pass max: 1", () => {
    const cfg = postgresPoolConfig("postgres://u:p@db.supabase.co:6543/postgres");
    assert.equal(cfg.max, 4);
    assert.equal(cfg.idleTimeoutMillis, 2000);
    assert.equal(cfg.connectionTimeoutMillis, 4000);
    assert.equal(cfg.options, "-c statement_timeout=8000");
    assert.equal(postgresPoolConfig("postgres://u:p@db.supabase.co:6543/postgres", { max: 1 }).max, 1);
  });
});

