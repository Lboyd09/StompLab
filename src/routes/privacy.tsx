import { createFileRoute, Link } from "@tanstack/react-router";
import { LEGAL_EFFECTIVE, LEGAL_VERSION, PRIVACY_SECTIONS } from "@/lib/legal";
import { PUBLIC_SUPPORT_EMAIL } from "@/lib/plan";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-16">
      <header className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Stomp Lab</p>
        <h1 className="font-display text-4xl font-semibold uppercase leading-[0.9] tracking-tight">Privacy</h1>
        <p className="text-sm text-muted-foreground">
          Version {LEGAL_VERSION}. Effective {LEGAL_EFFECTIVE}.
        </p>
      </header>

      {PRIVACY_SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="space-y-3">
          <h2 className="font-display text-lg font-semibold">{s.title}</h2>
          {s.body.map((p) => (
            <p key={p.slice(0, 40)} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}

      <p className="text-sm text-muted-foreground">
        Full terms:{" "}
        <Link to="/terms" className="text-primary underline underline-offset-2">
          /terms
        </Link>
        . Questions:{" "}
        <a href={`mailto:${PUBLIC_SUPPORT_EMAIL}`} className="text-primary underline underline-offset-2">
          {PUBLIC_SUPPORT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
