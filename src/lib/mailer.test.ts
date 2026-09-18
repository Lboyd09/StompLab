import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mailerConfigured, mailFrom } from "./mailer.ts";

describe("mailer", () => {
  const keys = ["RESEND_API_KEY", "RESEND_KEY", "RESEND_TOKEN", "SMTP_URL", "SMTP_PASS", "MAIL_FROM", "EMAIL_FROM"] as const;

  function snap() {
    return Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  }
  function restore(prev: Record<string, string | undefined>) {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }

  it("is off when no send key is set", () => {
    const prev = snap();
    try {
      for (const k of keys) delete process.env[k];
      process.env.SMTP_URL = "smtp://x";
      assert.equal(mailerConfigured(), false);
    } finally {
      restore(prev);
    }
  });

  it("is on when Resend is set, and MAIL_FROM wins", () => {
    const prev = snap();
    try {
      process.env.RESEND_API_KEY = "re_test";
      process.env.MAIL_FROM = "Stomp Lab <hello@example.com>";
      assert.equal(mailerConfigured(), true);
      assert.equal(mailFrom(), "Stomp Lab <hello@example.com>");
    } finally {
      restore(prev);
    }
  });

  it("is on when RESEND_KEY is set", () => {
    const prev = snap();
    try {
      for (const k of keys) delete process.env[k];
      process.env.RESEND_KEY = "re_alt";
      assert.equal(mailerConfigured(), true);
    } finally {
      restore(prev);
    }
  });
});
